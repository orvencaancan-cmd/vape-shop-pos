-- Missing from 0002: owners need to be able to remove a staff member.
-- The last-owner guardrail trigger (0003) already prevents this from
-- leaving a shop's remaining staff without an owner.
create policy "profiles_delete_owner" on profiles for delete
  using (shop_id = current_shop_id() and is_owner());
