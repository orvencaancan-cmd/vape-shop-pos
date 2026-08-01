-- register_loyalty_customer's `returns table (customer_id, name, phone, ...)`
-- declares those as OUT parameters, which are visible as plain identifiers
-- throughout the whole function body -- including inside
-- `on conflict (owner_user_id, phone)`, where "phone" then collides with
-- both the loyalty_customers.phone column and the OUT parameter of the
-- same name, raising "column reference \"phone\" is ambiguous". Switching
-- to the named-constraint form of ON CONFLICT sidesteps it entirely, since
-- a constraint name isn't a column reference at all. (search_loyalty_customers
-- doesn't have this problem -- it only ever references phone/name through
-- the "lc." table alias.)

create or replace function register_loyalty_customer(p_shop_id uuid, p_name text, p_phone text)
returns table (
  customer_id uuid, name text, phone text, credit_balance numeric,
  earn_enabled boolean, redeem_enabled boolean, reward_percent numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_name text;
  v_earn_enabled boolean;
  v_redeem_enabled boolean;
  v_reward_percent numeric;
  v_owner_user_id uuid;
  v_customer_id uuid;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null then
    raise exception 'enter a name';
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_phone = '' then
    raise exception 'enter a phone number';
  end if;

  select loyalty_earn_enabled, loyalty_redeem_enabled, loyalty_reward_percent
    into v_earn_enabled, v_redeem_enabled, v_reward_percent
    from shops where id = p_shop_id;

  if not v_earn_enabled and not v_redeem_enabled then
    raise exception 'loyalty program is not enabled for this branch';
  end if;

  select user_id into v_owner_user_id
    from profiles
    where shop_id = p_shop_id and role = 'owner'
    order by created_at asc
    limit 1;
  if v_owner_user_id is null then
    raise exception 'shop has no owner to attribute loyalty records to';
  end if;

  insert into loyalty_customers (owner_user_id, phone, name)
    values (v_owner_user_id, v_phone, v_name)
    on conflict on constraint loyalty_customers_owner_user_id_phone_key do update
      set name = excluded.name
    returning id into v_customer_id;

  return query
    select lc.id, lc.name, lc.phone, lc.credit_balance,
           v_earn_enabled, v_redeem_enabled, v_reward_percent
      from loyalty_customers lc
      where lc.id = v_customer_id;
end;
$$;
