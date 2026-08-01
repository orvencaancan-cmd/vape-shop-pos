-- Replaces the free-form "redeem this amount" input with a single
-- "Use credit" toggle: when on, it applies as much of the customer's
-- balance as the sale total allows, then zeroes the balance outright --
-- any leftover beyond what the sale needed is forfeited, not kept for
-- next time. A sale that uses credit also skips earning new credit
-- (otherwise the balance would immediately tick back up off ₱0, which
-- defeats the "ends at zero" point of the toggle).
--
-- loyalty_credit_forfeited tracks the wiped-out leftover so void_sale can
-- restore the exact pre-sale balance (redeemed + forfeited), not just the
-- amount that reduced the sale total.

alter table sales add column loyalty_credit_forfeited numeric not null default 0
  check (loyalty_credit_forfeited >= 0);

drop function if exists record_sale(uuid, jsonb, text, numeric, text, text, text, numeric);

create function record_sale(
  p_shop_id uuid,
  items jsonb,
  p_payment_method text default 'cash',
  p_discount_amount numeric default 0,
  p_discount_reason text default null,
  p_loyalty_phone text default null,
  p_loyalty_name text default null,
  p_loyalty_use_credit boolean default false
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
  v_loyalty_redeemed numeric := 0;
  v_loyalty_forfeited numeric := 0;
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
  if v_loyalty_phone is null and p_loyalty_use_credit then
    raise exception 'cannot use loyalty credit without a phone number';
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

    if p_loyalty_use_credit and not v_redeem_enabled then
      raise exception 'this branch does not accept loyalty redemptions';
    end if;

    if p_loyalty_use_credit then
      v_loyalty_redeemed := least(v_total, v_customer_balance);
      v_loyalty_forfeited := v_customer_balance - v_loyalty_redeemed;
      v_total := v_total - v_loyalty_redeemed;
      -- earning is skipped on a sale that uses credit -- otherwise the
      -- balance would tick back up off zero from the same transaction.
      update loyalty_customers set credit_balance = 0 where id = v_customer_id;
    elsif v_earn_enabled then
      v_loyalty_earned := round(v_total * v_reward_percent / 100, 2);
      update loyalty_customers
        set credit_balance = credit_balance + v_loyalty_earned
        where id = v_customer_id;
    end if;
  end if;

  update sales set
    total = v_total,
    discount_amount = p_discount_amount,
    discount_reason = nullif(trim(coalesce(p_discount_reason, '')), ''),
    loyalty_customer_id = v_customer_id,
    loyalty_credit_redeemed = v_loyalty_redeemed,
    loyalty_credit_earned = v_loyalty_earned,
    loyalty_credit_forfeited = v_loyalty_forfeited
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
  v_loyalty_forfeited numeric;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;

  select created_by, loyalty_customer_id, loyalty_credit_redeemed, loyalty_credit_earned,
         loyalty_credit_forfeited
    into v_created_by, v_loyalty_customer_id, v_loyalty_redeemed, v_loyalty_earned,
         v_loyalty_forfeited
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
      set credit_balance = greatest(0, credit_balance + v_loyalty_redeemed + v_loyalty_forfeited - v_loyalty_earned)
      where id = v_loyalty_customer_id;
  end if;

  update sales set voided_at = now(), voided_by = v_profile_id where id = p_sale_id;
end;
$$;
