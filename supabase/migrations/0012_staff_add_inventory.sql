-- Staff can now create new products/variants (via the guided add-flavors /
-- add-accessory flows), but editing or deleting existing inventory stays
-- owner-only. Mirrors the existing suppliers_insert / suppliers_update_owner
-- split (0002_rls.sql). For variants specifically, non-owners may only
-- insert rows with cost = 0 — the app hides the Cost field from staff, but
-- this is the actual enforcement, at the database level, regardless of
-- what a client sends.
drop policy "products_write_owner" on products;
create policy "products_insert_member" on products for insert
  with check (shop_id = current_shop_id());
create policy "products_update_owner" on products for update
  using (shop_id = current_shop_id() and is_owner())
  with check (shop_id = current_shop_id() and is_owner());
create policy "products_delete_owner" on products for delete
  using (shop_id = current_shop_id() and is_owner());

drop policy "variants_write_owner" on variants;
create policy "variants_insert_member" on variants for insert
  with check (shop_id = current_shop_id() and (is_owner() or cost = 0));
create policy "variants_update_owner" on variants for update
  using (shop_id = current_shop_id() and is_owner())
  with check (shop_id = current_shop_id() and is_owner());
create policy "variants_delete_owner" on variants for delete
  using (shop_id = current_shop_id() and is_owner());
