-- Voiding a sale now requires a short note explaining why (e.g. "rung up by
-- mistake", "customer returned item"), stored alongside the existing
-- voided_at/voided_by audit trail. No column-level grant needed -- like
-- voided_at/voided_by, this is only ever written from inside the
-- SECURITY DEFINER void_sale() function below, never via a direct client
-- update.
alter table sales add column voided_reason text;

drop function if exists void_sale(uuid, uuid);

create function void_sale(p_shop_id uuid, p_sale_id uuid, p_reason text default null)
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

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'a reason is required to void a sale';
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

  update sales set voided_at = now(), voided_by = v_profile_id, voided_reason = trim(p_reason)
    where id = p_sale_id;
end;
$$;
