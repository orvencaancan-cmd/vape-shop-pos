-- The Sell screen's loyalty lookup was phone-first (search by number, name
-- shown as the result), but a cashier naturally opens with "what's your
-- name?" not "what's your number?" -- flip it: search by name, phone shown
-- as verification once found. Also adds an explicit "save this new
-- customer now" action, since silently carrying a typed name into
-- record_sale (with no confirmation step, and no way to trigger it via
-- Enter) wasn't discoverable. Both resolve "the" owner identically to
-- record_sale (see 0026's note) -- duplicated inline, not shared, for the
-- same reason a standalone owner-resolution function would be unsafe.

drop function if exists lookup_loyalty_customer(uuid, text);

create function search_loyalty_customers(p_shop_id uuid, p_name text)
returns table (
  customer_id uuid, name text, phone text, credit_balance numeric,
  earn_enabled boolean, redeem_enabled boolean, reward_percent numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_earn_enabled boolean;
  v_redeem_enabled boolean;
  v_reward_percent numeric;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'enter a name to search';
  end if;

  select loyalty_earn_enabled, loyalty_redeem_enabled, loyalty_reward_percent
    into v_earn_enabled, v_redeem_enabled, v_reward_percent
    from shops where id = p_shop_id;

  select user_id into v_owner_user_id
    from profiles
    where shop_id = p_shop_id and role = 'owner'
    order by created_at asc
    limit 1;

  return query
    select lc.id, lc.name, lc.phone, lc.credit_balance,
           v_earn_enabled, v_redeem_enabled, v_reward_percent
      from loyalty_customers lc
      where lc.owner_user_id = v_owner_user_id
        and lc.name ilike '%' || trim(p_name) || '%'
      order by lc.name
      limit 10;
end;
$$;

create function register_loyalty_customer(p_shop_id uuid, p_name text, p_phone text)
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

  -- Unlike record_sale's implicit upsert (which preserves an existing name
  -- rather than clobbering it during an ordinary sale), this is an explicit
  -- "save this customer" action -- the name staff just typed should win if
  -- this phone turns out to already be registered under a different one.
  insert into loyalty_customers (owner_user_id, phone, name)
    values (v_owner_user_id, v_phone, v_name)
    on conflict (owner_user_id, phone) do update
      set name = excluded.name
    returning id into v_customer_id;

  return query
    select lc.id, lc.name, lc.phone, lc.credit_balance,
           v_earn_enabled, v_redeem_enabled, v_reward_percent
      from loyalty_customers lc
      where lc.id = v_customer_id;
end;
$$;
