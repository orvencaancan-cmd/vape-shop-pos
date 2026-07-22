-- Voiding a sale: keeps the original row (full audit trail of what was
-- rung up and who undid it) rather than deleting it, and restores the
-- stock it deducted. Owners can void any sale in their shop; staff can
-- void only sales they personally made.
alter table sales add column voided_at timestamptz;
alter table sales add column voided_by uuid references profiles (id) on delete set null;

create or replace function void_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := current_shop_id();
  v_created_by uuid;
  v_is_owner boolean;
  v_item record;
begin
  if v_shop_id is null then
    raise exception 'not authenticated as a shop member';
  end if;

  select created_by into v_created_by
    from sales
    where id = p_sale_id and shop_id = v_shop_id and voided_at is null
    for update;

  if not found then
    raise exception 'sale not found or already voided';
  end if;

  select is_owner() into v_is_owner;
  if not v_is_owner and v_created_by is distinct from auth.uid() then
    raise exception 'not permitted to void this sale';
  end if;

  for v_item in select variant_id, quantity from sale_items where sale_id = p_sale_id
  loop
    update variants set stock_qty = stock_qty + v_item.quantity where id = v_item.variant_id;
  end loop;

  update sales set voided_at = now(), voided_by = auth.uid() where id = p_sale_id;
end;
$$;
