-- Loyalty store-credit program. First cross-shop-scoped table in an
-- otherwise entirely shop_id-scoped schema: a customer's balance is shared
-- across every shop belonging to the same owner login, the same way
-- getCurrentProfile()'s ownedShopCount/shops already treats "my shops" as
-- "shops where auth.uid() has a role='owner' profiles row" -- there is no
-- separate business/tenant table to key off instead.

alter table shops add column loyalty_earn_enabled boolean not null default false;
alter table shops add column loyalty_redeem_enabled boolean not null default false;
alter table shops add column loyalty_reward_percent numeric not null default 0
  check (loyalty_reward_percent >= 0 and loyalty_reward_percent <= 100);

create table loyalty_customers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null,
  name text,
  credit_balance numeric not null default 0 check (credit_balance >= 0),
  created_at timestamptz not null default now(),
  unique (owner_user_id, phone)
);

alter table sales add column loyalty_customer_id uuid references loyalty_customers (id) on delete set null;
alter table sales add column loyalty_credit_redeemed numeric not null default 0 check (loyalty_credit_redeemed >= 0);
alter table sales add column loyalty_credit_earned numeric not null default 0 check (loyalty_credit_earned >= 0);
create index sales_loyalty_customer_id_idx on sales (loyalty_customer_id);

-- A shop can have more than one owner row (prevent_last_owner_removal in
-- 0003 only blocks removing the *last* one; invite-staff.ts and the staff
-- role-change action both let an owner add/promote co-owners). Every place
-- that needs "the" owner user_id for a shop -- here and in
-- lookup_loyalty_customer below -- resolves it identically: the earliest
-- owner row (the shop's founding owner, created atomically with the shop
-- in create_shop), never an unordered `limit 1`. This is duplicated inline
-- rather than factored into a shared function deliberately -- a standalone
-- function returning a raw auth.users.id would be callable as a public RPC
-- by any authenticated user for any shop id, since Postgres grants EXECUTE
-- to PUBLIC by default and this project doesn't revoke it for functions.

alter table loyalty_customers enable row level security;

create function is_member_of_owner_business(p_owner_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles me
    join profiles owner_row on owner_row.shop_id = me.shop_id and owner_row.role = 'owner'
    where me.user_id = auth.uid() and owner_row.user_id = p_owner_user_id
  )
$$;

create policy "loyalty_customers_select" on loyalty_customers for select
  using (is_member_of_owner_business(owner_user_id) or is_platform_admin());
-- deliberately no insert/update/delete policy for authenticated/anon --
-- all mutation happens inside record_sale/void_sale (security definer).

drop function if exists record_sale(uuid, jsonb, text, numeric, text);

create function record_sale(
  p_shop_id uuid,
  items jsonb,
  p_payment_method text default 'cash',
  p_discount_amount numeric default 0,
  p_discount_reason text default null,
  p_loyalty_phone text default null,
  p_loyalty_name text default null,
  p_loyalty_redeem numeric default 0
)
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
  v_loyalty_phone text;
  v_earn_enabled boolean;
  v_redeem_enabled boolean;
  v_reward_percent numeric;
  v_owner_user_id uuid;
  v_customer_id uuid;
  v_customer_balance numeric;
  v_loyalty_earned numeric := 0;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;
  if jsonb_array_length(items) = 0 then
    raise exception 'cart is empty';
  end if;
  if p_payment_method not in ('cash', 'gcash') then
    raise exception 'invalid payment method';
  end if;
  if p_discount_amount < 0 then
    raise exception 'discount cannot be negative';
  end if;
  if p_loyalty_redeem < 0 then
    raise exception 'redeemed credit cannot be negative';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  insert into sales (shop_id, created_by, payment_method) values (p_shop_id, v_profile_id, p_payment_method)
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

  if p_discount_amount > v_total then
    raise exception 'discount exceeds sale subtotal';
  end if;
  v_total := v_total - p_discount_amount;

  v_loyalty_phone := nullif(trim(coalesce(p_loyalty_phone, '')), '');
  if v_loyalty_phone is not null then
    v_loyalty_phone := regexp_replace(v_loyalty_phone, '\D', '', 'g');
    if v_loyalty_phone = '' then
      raise exception 'invalid loyalty phone number';
    end if;
  end if;
  if v_loyalty_phone is null and p_loyalty_redeem > 0 then
    raise exception 'cannot redeem loyalty credit without a phone number';
  end if;

  if v_loyalty_phone is not null then
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
      values (v_owner_user_id, v_loyalty_phone, nullif(trim(coalesce(p_loyalty_name, '')), ''))
      on conflict (owner_user_id, phone) do update
        set name = coalesce(loyalty_customers.name, excluded.name)
      returning id, credit_balance into v_customer_id, v_customer_balance;

    if p_loyalty_redeem > 0 and not v_redeem_enabled then
      raise exception 'this branch does not accept loyalty redemptions';
    end if;
    if p_loyalty_redeem > v_total then
      raise exception 'redeemed credit exceeds sale total';
    end if;
    if p_loyalty_redeem > v_customer_balance then
      raise exception 'redeemed credit exceeds customer balance';
    end if;

    v_total := v_total - p_loyalty_redeem;
    if v_earn_enabled then
      v_loyalty_earned := round(v_total * v_reward_percent / 100, 2);
    end if;

    update loyalty_customers
      set credit_balance = credit_balance - p_loyalty_redeem + v_loyalty_earned
      where id = v_customer_id;
  end if;

  update sales set
    total = v_total,
    discount_amount = p_discount_amount,
    discount_reason = nullif(trim(coalesce(p_discount_reason, '')), ''),
    loyalty_customer_id = v_customer_id,
    loyalty_credit_redeemed = p_loyalty_redeem,
    loyalty_credit_earned = v_loyalty_earned
    where id = v_sale_id;

  return v_sale_id;
end;
$$;

create or replace function void_sale(p_shop_id uuid, p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
  v_profile_id uuid;
  v_item record;
  v_loyalty_customer_id uuid;
  v_loyalty_redeemed numeric;
  v_loyalty_earned numeric;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;

  select created_by, loyalty_customer_id, loyalty_credit_redeemed, loyalty_credit_earned
    into v_created_by, v_loyalty_customer_id, v_loyalty_redeemed, v_loyalty_earned
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

  if v_loyalty_customer_id is not null then
    update loyalty_customers
      set credit_balance = greatest(0, credit_balance + v_loyalty_redeemed - v_loyalty_earned)
      where id = v_loyalty_customer_id;
  end if;

  update sales set voided_at = now(), voided_by = v_profile_id where id = p_sale_id;
end;
$$;

-- Combined lookup used by the Sell screen's phone-search box. Deliberately
-- one round trip and never exposes owner_user_id itself to the client --
-- keeps the "which owner row wins" resolution logic in exactly one place
-- (mirrored, not shared, with record_sale -- see note above).
create function lookup_loyalty_customer(p_shop_id uuid, p_phone text)
returns table (
  customer_id uuid, name text, credit_balance numeric,
  earn_enabled boolean, redeem_enabled boolean, reward_percent numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_phone text;
  v_owner_user_id uuid;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_phone = '' then
    raise exception 'invalid loyalty phone number';
  end if;

  select user_id into v_owner_user_id
    from profiles
    where shop_id = p_shop_id and role = 'owner'
    order by created_at asc
    limit 1;

  return query
    select lc.id, lc.name, lc.credit_balance,
           s.loyalty_earn_enabled, s.loyalty_redeem_enabled, s.loyalty_reward_percent
      from shops s
      left join loyalty_customers lc
        on lc.owner_user_id = v_owner_user_id and lc.phone = v_phone
      where s.id = p_shop_id;
end;
$$;
