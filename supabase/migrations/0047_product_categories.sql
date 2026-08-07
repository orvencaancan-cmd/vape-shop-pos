-- Eliminates the "Accessory" category. Every former accessory subcategory
-- (Cartridge, Flavor Pod, Device, Pod Device, Wire, Cotton) becomes a
-- first-class category in its own right, stored directly in
-- products.category -- subcategory is now redundant and dropped. Any
-- accessory row that didn't cleanly map to one of those six (no
-- subcategory set, or a stray value like "Battery" predating the fixed
-- config) lands in a new catch-all "Other" category rather than being
-- silently reclassified by guessing -- the owner can manually recategorize
-- those few items via the edit form afterward.

-- The three category check constraints were never explicitly named (plain
-- inline `check (...)`), so this finds and drops whatever Postgres
-- auto-generated rather than guessing the name -- safer for a migration
-- that's pasted and run once, with no chance to fix a wrong guess. This
-- has to run BEFORE the backfill below: the old constraint only allows
-- ('ejuice', 'accessory'), so setting category to 'Other' or any of the
-- former subcategory names while it's still active would itself violate
-- it.
do $$
declare
  r record;
begin
  for r in
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where contype = 'c'
      and conrelid in ('products'::regclass, 'floating_products'::regclass, 'inventory_transfer_lines'::regclass)
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- Backfill, before dropping the subcategory column that this reads.
update products set category = case
  when category = 'accessory' and subcategory in (
    'Cartridge', 'Flavor Pod', 'Device', 'Pod Device', 'Wire', 'Cotton'
  )
    then subcategory
  when category = 'accessory' then 'Other'
  else category
end;

update floating_products set category = case
  when category = 'accessory' and subcategory in (
    'Cartridge', 'Flavor Pod', 'Device', 'Pod Device', 'Wire', 'Cotton'
  )
    then subcategory
  when category = 'accessory' then 'Other'
  else category
end;

update inventory_transfer_lines set category = case
  when category = 'accessory' and subcategory in (
    'Cartridge', 'Flavor Pod', 'Device', 'Pod Device', 'Wire', 'Cotton'
  )
    then subcategory
  when category = 'accessory' then 'Other'
  else category
end;

alter table products drop column subcategory;
alter table floating_products drop column subcategory;
alter table inventory_transfer_lines drop column subcategory;

alter table products add constraint products_category_check
  check (category in (
    'ejuice',
    'Cartridge',
    'Flavor Pod',
    'Device',
    'Pod Device',
    'Wire',
    'Cotton',
    'Other'
  ));
alter table floating_products add constraint floating_products_category_check
  check (category in (
    'ejuice',
    'Cartridge',
    'Flavor Pod',
    'Device',
    'Pod Device',
    'Wire',
    'Cotton',
    'Other'
  ));
alter table inventory_transfer_lines add constraint inventory_transfer_lines_category_check
  check (category in (
    'ejuice',
    'Cartridge',
    'Flavor Pod',
    'Device',
    'Pod Device',
    'Wire',
    'Cotton',
    'Other'
  ));

-- ---------------------------------------------------------------------
-- add_floating_stock: p_subcategory parameter removed (signature change,
-- so this needs drop + recreate rather than create or replace).
-- ---------------------------------------------------------------------
drop function if exists add_floating_stock(
  text, text, text, text, text, numeric, text, text, numeric, text, integer, numeric, numeric
);

create function add_floating_stock(
  p_category text,
  p_brand text,
  p_product_name text,
  p_flavor text default null,
  p_nicotine_mg numeric default null,
  p_size text default null,
  p_for_device text default null,
  p_ohms numeric default null,
  p_sku text default null,
  p_quantity integer default null,
  p_cost numeric default null,
  p_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_variant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_category not in (
    'ejuice',
    'Cartridge',
    'Flavor Pod',
    'Device',
    'Pod Device',
    'Wire',
    'Cotton',
    'Other'
  ) then
    raise exception 'invalid category';
  end if;
  if p_product_name is null or trim(p_product_name) = '' then
    raise exception 'product name is required';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  select id into v_product_id
    from floating_products
    where owner_user_id = auth.uid()
      and category = p_category
      and archived = false
      and lower(trim(name)) = lower(trim(p_product_name))
      and coalesce(lower(trim(brand)), '') = coalesce(lower(trim(p_brand)), '')
    limit 1;

  if v_product_id is null then
    insert into floating_products (owner_user_id, name, category, brand)
      values (auth.uid(), trim(p_product_name), p_category, nullif(trim(coalesce(p_brand, '')), ''))
      returning id into v_product_id;
  end if;

  select id into v_variant_id
    from floating_variants
    where owner_user_id = auth.uid()
      and product_id = v_product_id
      and coalesce(lower(trim(flavor)), '') = coalesce(lower(trim(p_flavor)), '')
      and coalesce(nicotine_mg, -1) = coalesce(p_nicotine_mg, -1)
      and coalesce(lower(trim(size)), '') = coalesce(lower(trim(p_size)), '')
      and coalesce(lower(trim(for_device)), '') = coalesce(lower(trim(p_for_device)), '')
      and coalesce(ohms, -1) = coalesce(p_ohms, -1)
    limit 1;

  if v_variant_id is not null then
    update floating_variants
      set stock_qty = stock_qty + p_quantity,
          cost = coalesce(p_cost, cost),
          price = coalesce(p_price, price)
      where id = v_variant_id;
  else
    insert into floating_variants (
      owner_user_id, product_id, flavor, nicotine_mg, size, for_device, ohms, sku, cost, price, stock_qty
    ) values (
      auth.uid(), v_product_id, nullif(trim(coalesce(p_flavor, '')), ''), p_nicotine_mg,
      nullif(trim(coalesce(p_size, '')), ''), nullif(trim(coalesce(p_for_device, '')), ''), p_ohms,
      nullif(trim(coalesce(p_sku, '')), ''), coalesce(p_cost, 0), coalesce(p_price, 0), p_quantity
    )
    returning id into v_variant_id;
  end if;

  return v_variant_id;
end;
$$;

-- ---------------------------------------------------------------------
-- create_inventory_transfer: signature unchanged, just stops reading and
-- snapshotting subcategory (product.category alone is now the full story).
-- ---------------------------------------------------------------------
create or replace function create_inventory_transfer(
  p_source_type text,
  p_source_shop_id uuid,
  p_destination_type text,
  p_destination_shop_id uuid,
  p_lines jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_id uuid;
  v_profile_id uuid;
  v_line jsonb;
  v_variant_id uuid;
  v_floating_variant_id uuid;
  v_sent_qty integer;
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_source_type not in ('branch', 'floating') or p_destination_type not in ('branch', 'floating') then
    raise exception 'invalid transfer endpoint';
  end if;
  if p_source_type = 'branch' and p_source_shop_id is null then
    raise exception 'source branch is required';
  end if;
  if p_destination_type = 'branch' and p_destination_shop_id is null then
    raise exception 'destination branch is required';
  end if;
  if p_source_type = 'floating' then
    p_source_shop_id := null;
  end if;
  if p_destination_type = 'floating' then
    p_destination_shop_id := null;
  end if;
  if p_source_type = p_destination_type and p_source_shop_id is not distinct from p_destination_shop_id then
    raise exception 'source and destination must be different';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'add at least one item';
  end if;
  if p_source_type = 'branch' and not is_owner(p_source_shop_id) then
    raise exception 'you must own the source branch';
  end if;
  if p_destination_type = 'branch' and not is_owner(p_destination_shop_id) then
    raise exception 'you must own the destination branch';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() order by created_at asc limit 1;

  insert into inventory_transfers (
    source_type, source_shop_id, destination_type, destination_shop_id, note, owner_user_id, initiated_by
  ) values (
    p_source_type, p_source_shop_id, p_destination_type, p_destination_shop_id,
    nullif(trim(coalesce(p_note, '')), ''), auth.uid(), v_profile_id
  )
  returning id into v_transfer_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sent_qty := (v_line ->> 'sent_qty')::integer;
    if v_sent_qty is null or v_sent_qty <= 0 then
      raise exception 'each item needs a positive quantity';
    end if;

    if p_source_type = 'branch' then
      v_variant_id := (v_line ->> 'variant_id')::uuid;
      if v_variant_id is null then
        raise exception 'missing item for a branch-sourced line';
      end if;

      select v.stock_qty, p.name, p.brand, p.category,
             v.flavor, v.nicotine_mg, v.size, v.for_device, v.ohms, v.sku, v.cost, v.price
        into v_row
        from variants v join products p on p.id = v.product_id
        where v.id = v_variant_id and v.shop_id = p_source_shop_id
        for update of v;

      if not found then
        raise exception 'item does not belong to the source branch';
      end if;
      if v_row.stock_qty < v_sent_qty then
        raise exception 'not enough stock for %', v_row.name;
      end if;

      insert into inventory_transfer_lines (
        transfer_id, product_name, brand, category, flavor, nicotine_mg, size,
        for_device, ohms, sku, cost, price, sent_qty, source_variant_id
      ) values (
        v_transfer_id, v_row.name, v_row.brand, v_row.category, v_row.flavor,
        v_row.nicotine_mg, v_row.size, v_row.for_device, v_row.ohms, v_row.sku, v_row.cost, v_row.price,
        v_sent_qty, v_variant_id
      );
    else
      v_floating_variant_id := (v_line ->> 'floating_variant_id')::uuid;
      if v_floating_variant_id is null then
        raise exception 'missing item for a floating-sourced line';
      end if;

      select v.stock_qty, p.name, p.brand, p.category,
             v.flavor, v.nicotine_mg, v.size, v.for_device, v.ohms, v.sku, v.cost, v.price
        into v_row
        from floating_variants v join floating_products p on p.id = v.product_id
        where v.id = v_floating_variant_id and v.owner_user_id = auth.uid()
        for update of v;

      if not found then
        raise exception 'item is not in your floating inventory';
      end if;
      if v_row.stock_qty < v_sent_qty then
        raise exception 'not enough floating stock for %', v_row.name;
      end if;

      insert into inventory_transfer_lines (
        transfer_id, product_name, brand, category, flavor, nicotine_mg, size,
        for_device, ohms, sku, cost, price, sent_qty, source_floating_variant_id
      ) values (
        v_transfer_id, v_row.name, v_row.brand, v_row.category, v_row.flavor,
        v_row.nicotine_mg, v_row.size, v_row.for_device, v_row.ohms, v_row.sku, v_row.cost, v_row.price,
        v_sent_qty, v_floating_variant_id
      );
    end if;
  end loop;

  return v_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- receive_inventory_transfer: signature unchanged, subcategory dropped
-- from every dedupe match / insert (both branch and floating destination
-- paths), same for the shortfall-flagging block added in 0046.
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
          insert into products (shop_id, name, category, brand)
            values (v_transfer.destination_shop_id, v_line.product_name, v_line.category, v_line.brand)
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
          insert into floating_products (owner_user_id, name, category, brand)
            values (v_transfer.owner_user_id, v_line.product_name, v_line.category, v_line.brand)
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
        insert into floating_products (owner_user_id, name, category, brand)
          values (v_transfer.owner_user_id, v_line.product_name, v_line.category, v_line.brand)
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
-- resolve_inventory_transfer_shortfall: signature unchanged, subcategory
-- dropped from the match-or-create-at-source path.
-- ---------------------------------------------------------------------
create or replace function resolve_inventory_transfer_shortfall(p_shortfall_id uuid, p_action text)
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
      insert into products (shop_id, name, category, brand)
        values (v_shortfall.source_shop_id, v_line.product_name, v_line.category, v_line.brand)
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
