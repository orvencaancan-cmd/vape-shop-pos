-- Extend the card-less trial from 14 days to 1 calendar month.

create or replace function create_shop(shop_name text, owner_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_tier text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select case
    when exists (select 1 from profiles where user_id = auth.uid() and role = 'owner')
    then 'additional'
    else 'primary'
  end into v_tier;

  insert into shops (name, billing_tier, trial_ends_at)
  values (shop_name, v_tier, now() + interval '1 month')
  returning id into v_shop_id;

  insert into profiles (user_id, shop_id, role, display_name)
  values (auth.uid(), v_shop_id, 'owner', owner_display_name);

  return v_shop_id;
end;
$$;
