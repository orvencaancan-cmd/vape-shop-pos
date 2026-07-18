-- Row Level Security: tenant isolation + role gating.
-- Helper functions run as SECURITY DEFINER so they can read `profiles`
-- without recursively triggering the RLS policy defined on `profiles` itself.

create or replace function current_shop_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select shop_id from profiles where id = auth.uid()
$$;

create or replace function is_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'owner' from profiles where id = auth.uid()), false)
$$;

create or replace function is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select platform_admin from profiles where id = auth.uid()), false)
$$;

alter table shops enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;
alter table variants enable row level security;
alter table suppliers enable row level security;
alter table stock_receipts enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;

-- shops: members see their own shop; platform admin can see all shops
-- (read-only — the platform owner never gets write access to a shop's
-- row, see "Platform Responsibilities & Support Model" in the plan).
create policy "shops_select" on shops for select
  using (id = current_shop_id() or is_platform_admin());

create policy "shops_update_owner" on shops for update
  using (id = current_shop_id() and is_owner());

-- profiles: members see their own shop's team; anyone can see (and only
-- ever insert/update) their own row directly for the initial signup RPC.
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or shop_id = current_shop_id());

create policy "profiles_update_owner" on profiles for update
  using (shop_id = current_shop_id() and is_owner());

-- products / variants: staff and owner can read; only owner can write
-- directly (price/cost/product edits). Stock quantity changes go through
-- the receive_stock and record_sale RPCs (0003_functions.sql), not
-- direct table writes, so there is no staff insert/update policy here.
create policy "products_select" on products for select
  using (shop_id = current_shop_id());
create policy "products_write_owner" on products for all
  using (shop_id = current_shop_id() and is_owner())
  with check (shop_id = current_shop_id() and is_owner());

create policy "variants_select" on variants for select
  using (shop_id = current_shop_id());
create policy "variants_write_owner" on variants for all
  using (shop_id = current_shop_id() and is_owner())
  with check (shop_id = current_shop_id() and is_owner());

-- suppliers: either role can add one (low-risk metadata); only owner
-- edits/removes (cleanup, merging duplicates).
create policy "suppliers_select" on suppliers for select
  using (shop_id = current_shop_id());
create policy "suppliers_insert" on suppliers for insert
  with check (shop_id = current_shop_id());
create policy "suppliers_update_owner" on suppliers for update
  using (shop_id = current_shop_id() and is_owner());
create policy "suppliers_delete_owner" on suppliers for delete
  using (shop_id = current_shop_id() and is_owner());

-- stock_receipts / sales / sale_items: read-only via RLS for reporting;
-- all writes happen through SECURITY DEFINER RPCs so stock math and
-- shop-ownership checks stay atomic and can't be bypassed by a direct
-- insert from a tampered client request.
create policy "stock_receipts_select" on stock_receipts for select
  using (shop_id = current_shop_id());

create policy "sales_select" on sales for select
  using (shop_id = current_shop_id());

create policy "sale_items_select" on sale_items for select
  using (shop_id = current_shop_id());
