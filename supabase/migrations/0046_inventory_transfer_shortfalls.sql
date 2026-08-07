-- Today receive_inventory_transfer treats a shortfall (received_qty <
-- sent_qty) as silent shrinkage: the source loses sent_qty, the
-- destination gains only received_qty, and the difference isn't recorded
-- anywhere visible -- it only exists as the gap between two columns on
-- inventory_transfer_lines, discoverable by querying the database
-- directly. The owner wants the missing units to land in the floating
-- pool instead, flagged, so they can later decide whether to send them
-- back to wherever the transfer originated or just keep them floating.
--
-- inventory_transfer_shortfalls is one row per short line, referencing
-- the floating_variant the missing units were folded into (same
-- match-or-create dedupe add_floating_stock already uses) and the
-- original source (branch or floating) so "return to source" knows
-- where to send them back. Descriptive fields aren't duplicated here --
-- they're read via transfer_line_id, which already snapshots them.

create table inventory_transfer_shortfalls (
  id uuid primary key default gen_random_uuid(),
  transfer_line_id uuid not null references inventory_transfer_lines (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  floating_variant_id uuid not null references floating_variants (id) on delete cascade,
  qty integer not null check (qty > 0),
  source_type text not null check (source_type in ('branch', 'floating')),
  source_shop_id uuid references shops (id) on delete set null,
  source_variant_id uuid references variants (id) on delete set null,
  status text not null default 'unresolved' check (status in ('unresolved', 'returned', 'kept')),
  resolved_by uuid references profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index inventory_transfer_shortfalls_owner_user_id_idx on inventory_transfer_shortfalls (owner_user_id);
create index inventory_transfer_shortfalls_status_idx on inventory_transfer_shortfalls (status);

alter table inventory_transfer_shortfalls enable row level security;

-- Owner-only, same as the rest of the floating catalog -- writes only
-- happen inside receive_inventory_transfer and
-- resolve_inventory_transfer_shortfall below.
create policy "inventory_transfer_shortfalls_select" on inventory_transfer_shortfalls for select
  using (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- receive_inventory_transfer: unchanged except for one addition -- when
-- a line's received_qty comes in under sent_qty, the difference is
-- folded into the floating pool (same match-or-create dedupe as the
-- rest of this function) and a shortfall row is inserted so it shows up
-- flagged on /floating-inventory instead of disappearing. This runs
-- regardless of what the destination itself is, so a branch-to-floating
-- pull-back that comes up short still gets flagged even though the bulk
-- of the credit already lands in the same pool.
-- ---------------------------------------------------------------------
create or replace function receive_inventory_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer inventory_transfers%rowtype;
  v_receiver_profile_id uuid;
  v_line record;
  v_source_stock integer;
  v_product_id uuid;
  v_variant_id uuid;
  v_unchecked_count integer;
  v_shortfall_qty integer;
  v_shortfall_variant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_transfer from inventory_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'transfer not found';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'this transfer is no longer pending';
  end if;

  if v_transfer.destination_type = 'branch' then
    if not is_member_of(v_transfer.destination_shop_id) then
      raise exception 'not authenticated as a member of the destination branch';
    end if;
    select id into v_receiver_profile_id
      from profiles where user_id = auth.uid() and shop_id = v_transfer.destination_shop_id;
  else
    if v_transfer.owner_user_id <> auth.uid() then
      raise exception 'only the owner can receive into the floating pool';
    end if;
    select id into v_receiver_profile_id
      from profiles where user_id = auth.uid() and role = 'owner' order by created_at asc limit 1;
  end if;

  select count(*) into v_unchecked_count
    from inventory_transfer_lines
    where transfer_id = p_transfer_id and received_qty is null;
  if v_unchecked_count > 0 then
    raise exception 'count every item before confirming receipt';
  end if;

  for v_line in select * from inventory_transfer_lines where transfer_id = p_transfer_id
  loop
    if v_line.source_variant_id is not null then
      select stock_qty into v_source_stock from variants where id = v_line.source_variant_id for update;
      if v_source_stock is null or v_source_stock < v_line.sent_qty then
        raise exception 'source stock for % changed unexpectedly -- ask the sender to check it', v_line.product_name;
      end if;
      update variants set stock_qty = stock_qty - v_line.sent_qty where id = v_line.source_variant_id;
    else
      select stock_qty into v_source_stock from floating_variants where id = v_line.source_floating_variant_id for update;
      if v_source_stock is null or v_source_stock < v_line.sent_qty then
        raise exception 'floating stock for % changed unexpectedly', v_line.product_name;
      end if;
      update floating_variants set stock_qty = stock_qty - v_line.sent_qty where id = v_line.source_floating_variant_id;
    end if;

    if v_line.received_qty > 0 then
      if v_transfer.destination_type = 'branch' then
        select id into v_product_id
          from products
          where shop_id = v_transfer.destination_shop_id
            and category = v_line.category
            and archived = false
            and lower(trim(name)) = lower(trim(v_line.product_name))
            and coalesce(lower(trim(brand)), '') = coalesce(lower(trim(v_line.brand)), '')
          limit 1;

        if v_product_id is null then
          insert into products (shop_id, name, category, brand, subcategory)
            values (v_transfer.destination_shop_id, v_line.product_name, v_line.category, v_line.brand, v_line.subcategory)
            returning id into v_product_id;
        end if;

        select id into v_variant_id
          from variants
          where shop_id = v_transfer.destination_shop_id
            and product_id = v_product_id
            and coalesce(lower(trim(flavor)), '') = coalesce(lower(trim(v_line.flavor)), '')
            and coalesce(nicotine_mg, -1) = coalesce(v_line.nicotine_mg, -1)
            and coalesce(lower(trim(size)), '') = coalesce(lower(trim(v_line.size)), '')
            and coalesce(lower(trim(for_device)), '') = coalesce(lower(trim(v_line.for_device)), '')
            and coalesce(ohms, -1) = coalesce(v_line.ohms, -1)
          limit 1;

        if v_variant_id is not null then
          update variants
            set stock_qty = stock_qty + v_line.received_qty,
                cost = case when v_line.cost > 0 then v_line.cost else cost end
            where id = v_variant_id;
        else
          insert into variants (
            shop_id, product_id, flavor, nicotine_mg, size, for_device, ohms, sku, cost, price, stock_qty
          ) values (
            v_transfer.destination_shop_id, v_product_id, v_line.flavor, v_line.nicotine_mg, v_line.size,
            v_line.for_device, v_line.ohms, v_line.sku, v_line.cost, v_line.price, v_line.received_qty
          )
          returning id into v_variant_id;
        end if;

        insert into stock_receipts (shop_id, variant_id, quantity_added, note, received_by)
          values (v_transfer.destination_shop_id, v_variant_id, v_line.received_qty, 'Received transfer', v_receiver_profile_id);
      else
        select id into v_product_id
          from floating_products
          where owner_user_id = v_transfer.owner_user_id
            and category = v_line.category
            and archived = false
            and lower(trim(name)) = lower(trim(v_line.product_name))
            and coalesce(lower(trim(brand)), '') = coalesce(lower(trim(v_line.brand)), '')
          limit 1;

        if v_product_id is null then
          insert into floating_products (owner_user_id, name, category, brand, subcategory)
            values (v_transfer.owner_user_id, v_line.product_name, v_line.category, v_line.brand, v_line.subcategory)
            returning id into v_product_id;
        end if;

        select id into v_variant_id
          from floating_variants
          where owner_user_id = v_transfer.owner_user_id
            and product_id = v_product_id
            and coalesce(lower(trim(flavor)), '') = coalesce(lower(trim(v_line.flavor)), '')
            and coalesce(nicotine_mg, -1) = coalesce(v_line.nicotine_mg, -1)
            and coalesce(lower(trim(size)), '') = coalesce(lower(trim(v_line.size)), '')
            and coalesce(lower(trim(for_device)), '') = coalesce(lower(trim(v_line.for_device)), '')
            and coalesce(ohms, -1) = coalesce(v_line.ohms, -1)
          limit 1;

        if v_variant_id is not null then
          update floating_variants
            set stock_qty = stock_qty + v_line.received_qty,
                cost = case when v_line.cost > 0 then v_line.cost else cost end
            where id = v_variant_id;
        else
          insert into floating_variants (
            owner_user_id, product_id, flavor, nicotine_mg, size, for_device, ohms, sku, cost, price, stock_qty
          ) values (
            v_transfer.owner_user_id, v_product_id, v_line.flavor, v_line.nicotine_mg, v_line.size,
            v_line.for_device, v_line.ohms, v_line.sku, v_line.cost, v_line.price, v_line.received_qty
          );
        end if;
      end if;
    end if;

    if v_line.sent_qty > v_line.received_qty then
      v_shortfall_qty := v_line.sent_qty - v_line.received_qty;

      select id into v_product_id
        from floating_products
        where owner_user_id = v_transfer.owner_user_id
          and category = v_line.category
          and archived = false
          and lower(trim(name)) = lower(trim(v_line.product_name))
          and coalesce(lower(trim(brand)), '') = coalesce(lower(trim(v_line.brand)), '')
        limit 1;

      if v_product_id is null then
        insert into floating_products (owner_user_id, name, category, brand, subcategory)
          values (v_transfer.owner_user_id, v_line.product_name, v_line.category, v_line.brand, v_line.subcategory)
          returning id into v_product_id;
      end if;

      select id into v_shortfall_variant_id
        from floating_variants
        where owner_user_id = v_transfer.owner_user_id
          and product_id = v_product_id
          and coalesce(lower(trim(flavor)), '') = coalesce(lower(trim(v_line.flavor)), '')
          and coalesce(nicotine_mg, -1) = coalesce(v_line.nicotine_mg, -1)
          and coalesce(lower(trim(size)), '') = coalesce(lower(trim(v_line.size)), '')
          and coalesce(lower(trim(for_device)), '') = coalesce(lower(trim(v_line.for_device)), '')
          and coalesce(ohms, -1) = coalesce(v_line.ohms, -1)
        limit 1;

      if v_shortfall_variant_id is not null then
        update floating_variants set stock_qty = stock_qty + v_shortfall_qty where id = v_shortfall_variant_id;
      else
        insert into floating_variants (
          owner_user_id, product_id, flavor, nicotine_mg, size, for_device, ohms, sku, cost, price, stock_qty
        ) values (
          v_transfer.owner_user_id, v_product_id, v_line.flavor, v_line.nicotine_mg, v_line.size,
          v_line.for_device, v_line.ohms, v_line.sku, v_line.cost, v_line.price, v_shortfall_qty
        )
        returning id into v_shortfall_variant_id;
      end if;

      insert into inventory_transfer_shortfalls (
        transfer_line_id, owner_user_id, floating_variant_id, qty, source_type, source_shop_id, source_variant_id
      ) values (
        v_line.id, v_transfer.owner_user_id, v_shortfall_variant_id, v_shortfall_qty,
        v_transfer.source_type, v_transfer.source_shop_id, v_line.source_variant_id
      );
    end if;
  end loop;

  update inventory_transfers set
    status = 'received', received_by = v_receiver_profile_id, received_at = now()
    where id = p_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- resolve_inventory_transfer_shortfall: owner-only. 'keep_in_floating'
-- just marks the flag resolved -- the units are already sitting in the
-- floating pool from receive_inventory_transfer above, nothing to move.
-- 'return_to_source' only applies when the shortfall came from a branch
-- (a floating-sourced shortfall has nowhere else to "return" to, since
-- it's already floating); it debits the floating pool and credits the
-- original source branch, preferring the exact variant it was debited
-- from if it still exists and isn't archived, else falling back to the
-- same case-insensitive match-or-create dedupe used everywhere else,
-- and logs a stock_receipts row so it shows up in "Last restocked".
-- ---------------------------------------------------------------------
create function resolve_inventory_transfer_shortfall(p_shortfall_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shortfall inventory_transfer_shortfalls%rowtype;
  v_line inventory_transfer_lines%rowtype;
  v_profile_id uuid;
  v_floating_stock integer;
  v_product_id uuid;
  v_variant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_action not in ('return_to_source', 'keep_in_floating') then
    raise exception 'invalid action';
  end if;

  select * into v_shortfall from inventory_transfer_shortfalls where id = p_shortfall_id for update;
  if not found then
    raise exception 'shortfall not found';
  end if;
  if v_shortfall.owner_user_id <> auth.uid() then
    raise exception 'only the owner can resolve a flagged shortfall';
  end if;
  if v_shortfall.status <> 'unresolved' then
    raise exception 'this shortfall was already resolved';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() order by created_at asc limit 1;

  if p_action = 'keep_in_floating' then
    update inventory_transfer_shortfalls set
      status = 'kept', resolved_by = v_profile_id, resolved_at = now()
      where id = p_shortfall_id;
    return;
  end if;

  if v_shortfall.source_type <> 'branch' or v_shortfall.source_shop_id is null then
    raise exception 'this shortfall has no branch to return to';
  end if;

  select * into v_line from inventory_transfer_lines where id = v_shortfall.transfer_line_id;

  select stock_qty into v_floating_stock from floating_variants where id = v_shortfall.floating_variant_id for update;
  if v_floating_stock is null or v_floating_stock < v_shortfall.qty then
    raise exception 'floating stock for this item changed unexpectedly';
  end if;
  update floating_variants set stock_qty = stock_qty - v_shortfall.qty where id = v_shortfall.floating_variant_id;

  if v_shortfall.source_variant_id is not null then
    select v.id into v_variant_id
      from variants v join products p on p.id = v.product_id
      where v.id = v_shortfall.source_variant_id
        and v.shop_id = v_shortfall.source_shop_id
        and p.archived = false;
  end if;

  if v_variant_id is null then
    select id into v_product_id
      from products
      where shop_id = v_shortfall.source_shop_id
        and category = v_line.category
        and archived = false
        and lower(trim(name)) = lower(trim(v_line.product_name))
        and coalesce(lower(trim(brand)), '') = coalesce(lower(trim(v_line.brand)), '')
      limit 1;

    if v_product_id is null then
      insert into products (shop_id, name, category, brand, subcategory)
        values (v_shortfall.source_shop_id, v_line.product_name, v_line.category, v_line.brand, v_line.subcategory)
        returning id into v_product_id;
    end if;

    select id into v_variant_id
      from variants
      where shop_id = v_shortfall.source_shop_id
        and product_id = v_product_id
        and coalesce(lower(trim(flavor)), '') = coalesce(lower(trim(v_line.flavor)), '')
        and coalesce(nicotine_mg, -1) = coalesce(v_line.nicotine_mg, -1)
        and coalesce(lower(trim(size)), '') = coalesce(lower(trim(v_line.size)), '')
        and coalesce(lower(trim(for_device)), '') = coalesce(lower(trim(v_line.for_device)), '')
        and coalesce(ohms, -1) = coalesce(v_line.ohms, -1)
      limit 1;

    if v_variant_id is null then
      insert into variants (
        shop_id, product_id, flavor, nicotine_mg, size, for_device, ohms, sku, cost, price, stock_qty
      ) values (
        v_shortfall.source_shop_id, v_product_id, v_line.flavor, v_line.nicotine_mg, v_line.size,
        v_line.for_device, v_line.ohms, v_line.sku, v_line.cost, v_line.price, 0
      )
      returning id into v_variant_id;
    end if;
  end if;

  update variants set stock_qty = stock_qty + v_shortfall.qty where id = v_variant_id;

  insert into stock_receipts (shop_id, variant_id, quantity_added, note, received_by)
    values (v_shortfall.source_shop_id, v_variant_id, v_shortfall.qty, 'Returned from floating (transfer shortfall)', v_profile_id);

  update inventory_transfer_shortfalls set
    status = 'returned', resolved_by = v_profile_id, resolved_at = now()
    where id = p_shortfall_id;
end;
$$;
