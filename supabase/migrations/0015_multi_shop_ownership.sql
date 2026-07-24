-- Multi-shop ownership: profiles becomes a membership table instead of a
-- strict 1:1 with auth.users, so one login can belong to more than one
-- shop. RLS shifts from "derive my one shop_id" (current_shop_id()) to
-- "am I a member of this specific shop" (is_member_of(shop_id) /
-- is_owner(shop_id)), which works correctly regardless of how many shops
-- a login has. The application (not the database) decides which shop is
-- "active" for a given request and passes that shop id explicitly.

-- ---------------------------------------------------------------------
-- 1. profiles: add user_id, decouple id from being =auth.users.id.
--    Existing rows keep their current id value (today id == the owning
--    auth user's id for every row), so downstream FKs to profiles(id)
--    from stock_receipts/sales need no data migration.
-- ---------------------------------------------------------------------
alter table profiles add column user_id uuid references auth.users (id) on delete cascade;
update profiles set user_id = id;
alter table profiles alter column user_id set not null;
create index profiles_user_id_idx on profiles (user_id);

alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles alter column id set default gen_random_uuid();

alter table profiles add constraint profiles_user_id_shop_id_key unique (user_id, shop_id);

-- ---------------------------------------------------------------------
-- 2. Drop every policy that depends on the old helper functions (Postgres
--    won't allow changing/dropping a function's signature while a policy
--    still references it).
-- ---------------------------------------------------------------------
drop policy "shops_select" on shops;
drop policy "shops_update_owner" on shops;

drop policy "profiles_select" on profiles;
drop policy "profiles_update_owner" on profiles;
drop policy "profiles_delete_owner" on profiles;

drop policy "products_select" on products;
drop policy "products_insert_member" on products;
drop policy "products_update_owner" on products;
drop policy "products_delete_owner" on products;

drop policy "variants_select" on variants;
drop policy "variants_insert_member" on variants;
drop policy "variants_update_owner" on variants;
drop policy "variants_delete_owner" on variants;

drop policy "suppliers_select" on suppliers;
drop policy "suppliers_insert" on suppliers;
drop policy "suppliers_update_owner" on suppliers;
drop policy "suppliers_delete_owner" on suppliers;

drop policy "stock_receipts_select" on stock_receipts;
drop policy "sales_select" on sales;
drop policy "sale_items_select" on sale_items;

-- shop_logos_public_read doesn't reference current_shop_id()/is_owner(),
-- so it's untouched.
drop policy "shop_logos_owner_write" on storage.objects;
drop policy "shop_logos_owner_update" on storage.objects;
drop policy "shop_logos_owner_delete" on storage.objects;

-- ---------------------------------------------------------------------
-- 3. Replace the helper functions. current_shop_id() is gone entirely —
--    there is no longer a single "my shop" to derive. is_owner() changes
--    signature (now takes the shop being checked), so the old zero-arg
--    version is dropped rather than left as dead-but-present overload.
-- ---------------------------------------------------------------------
drop function if exists current_shop_id();
drop function if exists is_owner();

create function is_member_of(p_shop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where user_id = auth.uid() and shop_id = p_shop_id
  )
$$;

create function is_owner(p_shop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and shop_id = p_shop_id and role = 'owner'
  )
$$;

-- platform_admin lives per-membership-row but is treated as a fact about
-- the login as a whole (true if any of the login's rows has it set) —
-- the dedicated platform-admin login only ever has one row in practice.
create or replace function is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select bool_or(platform_admin) from profiles where user_id = auth.uid()),
    false
  )
$$;

-- ---------------------------------------------------------------------
-- 4. Recreate every policy against the new membership-based helpers.
-- ---------------------------------------------------------------------
create policy "shops_select" on shops for select
  using (is_member_of(id) or is_platform_admin());

create policy "shops_update_owner" on shops for update
  using (is_owner(id));

create policy "profiles_select" on profiles for select
  using (user_id = auth.uid() or is_member_of(shop_id));

create policy "profiles_update_owner" on profiles for update
  using (is_owner(shop_id));

create policy "profiles_delete_owner" on profiles for delete
  using (is_owner(shop_id));

create policy "products_select" on products for select
  using (is_member_of(shop_id));
create policy "products_insert_member" on products for insert
  with check (is_member_of(shop_id));
create policy "products_update_owner" on products for update
  using (is_owner(shop_id))
  with check (is_owner(shop_id));
create policy "products_delete_owner" on products for delete
  using (is_owner(shop_id));

create policy "variants_select" on variants for select
  using (is_member_of(shop_id));
create policy "variants_insert_member" on variants for insert
  with check (is_member_of(shop_id) and (is_owner(shop_id) or cost = 0));
create policy "variants_update_owner" on variants for update
  using (is_owner(shop_id))
  with check (is_owner(shop_id));
create policy "variants_delete_owner" on variants for delete
  using (is_owner(shop_id));

create policy "suppliers_select" on suppliers for select
  using (is_member_of(shop_id));
create policy "suppliers_insert" on suppliers for insert
  with check (is_member_of(shop_id));
create policy "suppliers_update_owner" on suppliers for update
  using (is_owner(shop_id));
create policy "suppliers_delete_owner" on suppliers for delete
  using (is_owner(shop_id));

create policy "stock_receipts_select" on stock_receipts for select
  using (is_member_of(shop_id));

create policy "sales_select" on sales for select
  using (is_member_of(shop_id));

create policy "sale_items_select" on sale_items for select
  using (is_member_of(shop_id));

create policy "shop_logos_owner_write" on storage.objects for insert
  with check (
    bucket_id = 'shop-logos'
    and is_owner(((storage.foldername(name))[1])::uuid)
  );

create policy "shop_logos_owner_update" on storage.objects for update
  using (
    bucket_id = 'shop-logos'
    and is_owner(((storage.foldername(name))[1])::uuid)
  );

create policy "shop_logos_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'shop-logos'
    and is_owner(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------
-- 5. RPCs: accept an explicit p_shop_id instead of deriving one via
--    current_shop_id(), and verify membership up front. Audit-trail FKs
--    (created_by/received_by/voided_by -> profiles.id) now need the
--    caller's specific membership-row id at this shop, not auth.uid()
--    directly, since profiles.id no longer equals the auth user id.
--    create_shop's "already linked" block is removed — an existing
--    owner can now create additional shops with the same RPC used for
--    first-time onboarding.
-- ---------------------------------------------------------------------
create or replace function create_shop(shop_name text, owner_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into shops (name) values (shop_name) returning id into v_shop_id;

  insert into profiles (user_id, shop_id, role, display_name)
  values (auth.uid(), v_shop_id, 'owner', owner_display_name);

  return v_shop_id;
end;
$$;

drop function if exists record_sale(jsonb);

create function record_sale(p_shop_id uuid, items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_price numeric;
  v_cost numeric;
  v_stock integer;
  v_total numeric := 0;
  v_profile_id uuid;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;
  if jsonb_array_length(items) = 0 then
    raise exception 'cart is empty';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  insert into sales (shop_id, created_by) values (p_shop_id, v_profile_id)
    returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(items)
  loop
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid quantity for variant %', v_variant_id;
    end if;

    select price, cost, stock_qty into v_price, v_cost, v_stock
      from variants
      where id = v_variant_id and shop_id = p_shop_id
      for update;

    if not found then
      raise exception 'variant % does not belong to this shop', v_variant_id;
    end if;
    if v_stock < v_quantity then
      raise exception 'insufficient stock for variant %', v_variant_id;
    end if;

    insert into sale_items (shop_id, sale_id, variant_id, quantity, unit_price, unit_cost)
      values (p_shop_id, v_sale_id, v_variant_id, v_quantity, v_price, v_cost);

    update variants set stock_qty = stock_qty - v_quantity where id = v_variant_id;

    v_total := v_total + (v_price * v_quantity);
  end loop;

  update sales set total = v_total where id = v_sale_id;

  return v_sale_id;
end;
$$;

drop function if exists receive_stock(uuid, integer, uuid, numeric, text);

create function receive_stock(
  p_shop_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_supplier_id uuid default null,
  p_unit_cost numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_id uuid;
  v_profile_id uuid;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;
  if not exists (select 1 from variants where id = p_variant_id and shop_id = p_shop_id) then
    raise exception 'variant does not belong to this shop';
  end if;
  if p_supplier_id is not null
     and not exists (select 1 from suppliers where id = p_supplier_id and shop_id = p_shop_id) then
    raise exception 'supplier does not belong to this shop';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  insert into stock_receipts (shop_id, variant_id, supplier_id, quantity_added, unit_cost, note, received_by)
    values (p_shop_id, p_variant_id, p_supplier_id, p_quantity, p_unit_cost, p_note, v_profile_id)
    returning id into v_receipt_id;

  update variants
    set stock_qty = stock_qty + p_quantity,
        cost = coalesce(p_unit_cost, cost)
    where id = p_variant_id;

  return v_receipt_id;
end;
$$;

drop function if exists void_sale(uuid);

create function void_sale(p_shop_id uuid, p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
  v_profile_id uuid;
  v_item record;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;

  select created_by into v_created_by
    from sales
    where id = p_sale_id and shop_id = p_shop_id and voided_at is null
    for update;

  if not found then
    raise exception 'sale not found or already voided';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  if not is_owner(p_shop_id) and v_created_by is distinct from v_profile_id then
    raise exception 'not permitted to void this sale';
  end if;

  for v_item in select variant_id, quantity from sale_items where sale_id = p_sale_id
  loop
    update variants set stock_qty = stock_qty + v_item.quantity where id = v_item.variant_id;
  end loop;

  update sales set voided_at = now(), voided_by = v_profile_id where id = p_sale_id;
end;
$$;

-- prevent_last_owner_removal (0003_functions.sql) needs no change — it's
-- already scoped by shop_id and never references auth.uid() or the old
-- current_shop_id()/is_owner() helpers.
