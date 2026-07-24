-- Staff transfer: reassigns an existing staff member's profiles row to a
-- different shop the same owner-login controls, in place (same id), so
-- sales.created_by / stock_receipts.received_by / sales.voided_by FK
-- history stays intact. profiles_update_owner's RLS policy has no `with
-- check`, so it only verifies ownership of the OLD shop_id -- this RPC is
-- what actually enforces ownership of the destination shop too.
create or replace function transfer_staff(
  p_profile_id uuid,
  p_from_shop_id uuid,
  p_to_shop_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_current_shop uuid;
begin
  if p_from_shop_id = p_to_shop_id then
    raise exception 'source and destination shop must differ';
  end if;
  if not is_owner(p_from_shop_id) then
    raise exception 'not permitted: not an owner of the source shop';
  end if;
  if not is_owner(p_to_shop_id) then
    raise exception 'not permitted: not an owner of the destination shop';
  end if;

  select role, shop_id into v_role, v_current_shop
    from profiles
    where id = p_profile_id
    for update;

  if not found then
    raise exception 'staff member not found';
  end if;
  if v_current_shop is distinct from p_from_shop_id then
    raise exception 'staff member does not belong to the source shop';
  end if;
  -- Transferring an 'owner' row risks leaving the source shop with zero
  -- owners: prevent_last_owner_removal only fires on role/delete, not a
  -- plain shop_id update, so it would silently create an ownerless shop.
  -- Simplest safe rule: this feature only moves staff.
  if v_role <> 'staff' then
    raise exception 'only staff members can be transferred';
  end if;

  update profiles set shop_id = p_to_shop_id where id = p_profile_id;
end;
$$;
