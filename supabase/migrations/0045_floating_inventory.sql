-- Floating inventory: stock the owner holds outside any specific branch
-- (parallel to the floating cash pool in 0043/0044), transferable into or
-- back out of any branch. Physical stock is boxed up and driven over --
-- a real transit gap, exactly like cash -- so a transfer doesn't move
-- stock the instant it's sent. create_inventory_transfer only records
-- what's being sent; nothing is decremented until the destination works
-- through a checklist (a counted quantity per line, not a bare checkbox)
-- and receive_inventory_transfer runs, which debits the source and
-- credits the destination atomically in one transaction. On receipt, a
-- line matches an existing product/variant at the destination if one
-- already exists (same case-insensitive dedupe the batch-add flows in
-- inventory/actions.ts already use) and just adds to its stock; only
-- creates a new product/variant if nothing matches.
--
-- Branch-to-branch transfers aren't wired up in the UI this pass, but
-- the schema (source_type/destination_type each independently
-- 'branch'|'floating') supports it with no migration changes later.

create table floating_products (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in ('ejuice', 'accessory')),
  brand text,
  subcategory text,
  description text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index floating_products_owner_user_id_idx on floating_products (owner_user_id);

create table floating_variants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references floating_products (id) on delete cascade,
  flavor text,
  nicotine_mg numeric,
  size text,
  for_device text,
  ohms numeric,
  sku text,
  cost numeric(12,2) not null default 0,
  price numeric(12,2) not null default 0,
  stock_qty integer not null default 0,
  low_stock_threshold integer not null default 5,
  created_at timestamptz not null default now()
);
create index floating_variants_owner_user_id_idx on floating_variants (owner_user_id);
create index floating_variants_product_id_idx on floating_variants (product_id);

create table inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('branch', 'floating')),
  source_shop_id uuid references shops (id) on delete cascade,
  destination_type text not null check (destination_type in ('branch', 'floating')),
  destination_shop_id uuid references shops (id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  initiated_by uuid references profiles (id) on delete set null,
  received_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  cancelled_at timestamptz,
  check (
    (source_type = 'branch' and source_shop_id is not null) or
    (source_type = 'floating' and source_shop_id is null)
  ),
  check (
    (destination_type = 'branch' and destination_shop_id is not null) or
    (destination_type = 'floating' and destination_shop_id is null)
  ),
  check (source_type <> destination_type or source_shop_id is distinct from destination_shop_id)
);
create index inventory_transfers_source_shop_id_idx on inventory_transfers (source_shop_id);
create index inventory_transfers_destination_shop_id_idx on inventory_transfers (destination_shop_id);
create index inventory_transfers_owner_user_id_idx on inventory_transfers (owner_user_id);
create index inventory_transfers_status_idx on inventory_transfers (status);

-- One row per item in the shipment. Descriptive fields are snapshotted
-- at creation (same reasoning stock_audit_lines.system_qty and
-- stock_corrections.previous_qty/new_qty already snapshot rather than
-- live-join) so a line stays accurate even if the source product is
-- later renamed or archived. received_qty starts null -- that
-- nullability *is* the "has this line been counted yet" signal, the
-- same way a missing stock_audit_lines row means "not yet counted".
create table inventory_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references inventory_transfers (id) on delete cascade,
  product_name text not null,
  brand text,
  category text not null check (category in ('ejuice', 'accessory')),
  subcategory text,
  flavor text,
  nicotine_mg numeric,
  size text,
  for_device text,
  ohms numeric,
  sku text,
  cost numeric(12,2) not null default 0,
  price numeric(12,2) not null default 0,
  sent_qty integer not null check (sent_qty > 0),
  received_qty integer check (received_qty is null or received_qty >= 0),
  source_variant_id uuid references variants (id) on delete set null,
  source_floating_variant_id uuid references floating_variants (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_transfer_lines_transfer_id_idx on inventory_transfer_lines (transfer_id);
create index inventory_transfer_lines_source_variant_id_idx on inventory_transfer_lines (source_variant_id);
create index inventory_transfer_lines_source_floating_variant_id_idx
  on inventory_transfer_lines (source_floating_variant_id);

alter table floating_products enable row level security;
alter table floating_variants enable row level security;
alter table inventory_transfers enable row level security;
alter table inventory_transfer_lines enable row level security;

-- Floating catalog is owner-only, never visible to branch staff (mirrors
-- the Floating Cash Panel living solely on the owner-only /cash-flow
-- page). Select-only: every write happens inside the RPCs below, same
-- pattern as stock_receipts/stock_corrections/stock_audits.
create policy "floating_products_select" on floating_products for select
  using (owner_user_id = auth.uid());
create policy "floating_variants_select" on floating_variants for select
  using (owner_user_id = auth.uid());

-- Visible to the owner who sent it (business-wide, matches
-- cash_transfers_select) and to anyone on staff at either endpoint -- a
-- branch's own staff should see inventory awaiting them, or that they
-- sent, without needing the owner role.
create policy "inventory_transfers_select" on inventory_transfers for select
  using (
    owner_user_id = auth.uid()
    or (source_shop_id is not null and is_member_of(source_shop_id))
    or (destination_shop_id is not null and is_member_of(destination_shop_id))
  );

create policy "inventory_transfer_lines_select" on inventory_transfer_lines for select
  using (
    exists (
      select 1 from inventory_transfers t
      where t.id = inventory_transfer_lines.transfer_id
        and (
          t.owner_user_id = auth.uid()
          or (t.source_shop_id is not null and is_member_of(t.source_shop_id))
          or (t.destination_shop_id is not null and is_member_of(t.destination_shop_id))
        )
    )
  );

-- The destination side records its counted quantity directly (a plain
-- write, not an RPC) -- same reasoning stock_audit_lines' counted_qty is
-- member-writable: recording a count isn't a trust decision. Only
-- receive_inventory_transfer (below) actually moves stock, and it
-- re-checks status = 'pending' itself regardless of what this policy
-- allows.
create policy "inventory_transfer_lines_update_received_qty" on inventory_transfer_lines for update
  using (
    exists (
      select 1 from inventory_transfers t
      where t.id = inventory_transfer_lines.transfer_id
        and t.status = 'pending'
        and (
          (t.destination_type = 'branch' and is_member_of(t.destination_shop_id))
          or (t.destination_type = 'floating' and t.owner_user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from inventory_transfers t
      where t.id = inventory_transfer_lines.transfer_id
        and t.status = 'pending'
        and (
          (t.destination_type = 'branch' and is_member_of(t.destination_shop_id))
          or (t.destination_type = 'floating' and t.owner_user_id = auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------
-- add_floating_stock: the owner stocking the pool directly (new stock
-- landing outside any branch). Case-insensitive match against the
-- owner's existing floating catalog, same dedupe rule the batch-add
-- flows in inventory/actions.ts already use for shop-side products --
-- if matched, adds to stock_qty; else creates a new product+variant.
-- ---------------------------------------------------------------------
create function add_floating_stock(
  p_category text,
  p_brand text,
  p_product_name text,
  p_subcategory text default null,
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
  if p_category not in ('ejuice', 'accessory') then
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
    insert into floating_products (owner_user_id, name, category, brand, subcategory)
      values (
        auth.uid(), trim(p_product_name), p_category,
        nullif(trim(coalesce(p_brand, '')), ''), nullif(trim(coalesce(p_subcategory, '')), '')
      )
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
-- create_inventory_transfer: owner-only. Records what's being sent --
-- does NOT touch stock_qty yet, same as create_cash_transfer, since the
-- source keeps counting it until the destination receives it. p_lines
-- mirrors record_sale's existing items-jsonb pattern: an array of
-- {variant_id, sent_qty} (branch source) or {floating_variant_id,
-- sent_qty} (floating source). Covers both directions -- floating to a
-- branch, or pulling a branch's stock back into floating -- since
-- source/destination are just parameters.
-- ---------------------------------------------------------------------
create function create_inventory_transfer(
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

      select v.stock_qty, p.name, p.brand, p.category, p.subcategory,
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
        transfer_id, product_name, brand, category, subcategory, flavor, nicotine_mg, size,
        for_device, ohms, sku, cost, price, sent_qty, source_variant_id
      ) values (
        v_transfer_id, v_row.name, v_row.brand, v_row.category, v_row.subcategory, v_row.flavor,
        v_row.nicotine_mg, v_row.size, v_row.for_device, v_row.ohms, v_row.sku, v_row.cost, v_row.price,
        v_sent_qty, v_variant_id
      );
    else
      v_floating_variant_id := (v_line ->> 'floating_variant_id')::uuid;
      if v_floating_variant_id is null then
        raise exception 'missing item for a floating-sourced line';
      end if;

      select v.stock_qty, p.name, p.brand, p.category, p.subcategory,
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
        transfer_id, product_name, brand, category, subcategory, flavor, nicotine_mg, size,
        for_device, ohms, sku, cost, price, sent_qty, source_floating_variant_id
      ) values (
        v_transfer_id, v_row.name, v_row.brand, v_row.category, v_row.subcategory, v_row.flavor,
        v_row.nicotine_mg, v_row.size, v_row.for_device, v_row.ohms, v_row.sku, v_row.cost, v_row.price,
        v_sent_qty, v_floating_variant_id
      );
    end if;
  end loop;

  return v_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- receive_inventory_transfer: callable by any member of the destination
-- branch (or the owner, if destination is floating) -- receiving isn't
-- a trust decision, the risk was already gated at creation, same
-- reasoning receive_cash_transfer uses. Requires every line to already
-- have a counted received_qty (the server-side backstop for the UI's
-- disabled-Confirm rule), then debits the source by sent_qty and
-- credits the destination by received_qty -- a shortfall between the
-- two is real shrinkage, not a bookkeeping error, so it's allowed to
-- show up as a loss rather than silently reconciled away. Destination
-- match-or-create mirrors add_floating_stock's dedupe. All in one
-- transaction, so stock never exists at neither or both ends.
-- ---------------------------------------------------------------------
create function receive_inventory_transfer(p_transfer_id uuid)
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
  end loop;

  update inventory_transfers set
    status = 'received', received_by = v_receiver_profile_id, received_at = now()
    where id = p_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- cancel_inventory_transfer: lets the sender undo a mistaken transfer
-- before anyone's received it. Owner-only, same as creation. No stock
-- effect since nothing was decremented at creation.
-- ---------------------------------------------------------------------
create function cancel_inventory_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer inventory_transfers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_transfer from inventory_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'transfer not found';
  end if;
  if v_transfer.owner_user_id <> auth.uid() then
    raise exception 'only the owner who sent this transfer can cancel it';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'this transfer is no longer pending';
  end if;

  update inventory_transfers set status = 'cancelled', cancelled_at = now() where id = p_transfer_id;
end;
$$;
