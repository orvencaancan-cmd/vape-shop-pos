-- Branch-wide or item-scoped "Sale" promo. Mutually exclusive with the
-- manual staff Discount and with Loyalty (earn or redeem) -- see the
-- precedence block in record_sale below. sale_promo_products is named to
-- avoid colliding with the pre-existing, unrelated sale_items/sales
-- tables (a checkout transaction) even though both start with "sale".

alter table shops add column sale_enabled boolean not null default false;
alter table shops add column sale_percent numeric not null default 0
  check (sale_percent >= 0 and sale_percent <= 100);
alter table shops add column sale_scope text not null default 'branch'
  check (sale_scope in ('branch', 'items'));
alter table shops add column sale_starts_at timestamptz;
alter table shops add column sale_ends_at timestamptz;
alter table shops add constraint shops_sale_window_order
  check (sale_starts_at is null or sale_ends_at is null or sale_ends_at > sale_starts_at);

-- 0022 revoked table-wide UPDATE on shops -- any client-writable column
-- needs its own explicit grant, in THIS migration (0026 forgot this for
-- the loyalty columns and needed a follow-up migration to fix "permission
-- denied for table shops" -- not repeating that).
grant update (sale_enabled, sale_percent, sale_scope, sale_starts_at, sale_ends_at) on shops to authenticated;

create table sale_promo_products (
  shop_id uuid not null references shops (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, product_id)
);

alter table sale_promo_products enable row level security;

create policy "sale_promo_products_select" on sale_promo_products for select
  using (is_member_of(shop_id));
create policy "sale_promo_products_insert_owner" on sale_promo_products for insert
  with check (
    is_member_of(shop_id) and is_owner(shop_id)
    and exists (select 1 from products p where p.id = product_id and p.shop_id = sale_promo_products.shop_id)
  );
create policy "sale_promo_products_delete_owner" on sale_promo_products for delete
  using (is_member_of(shop_id) and is_owner(shop_id));
-- no update policy -- the settings UI always does a delete-all-then-
-- insert-selected replace, never a row-level edit.

alter table sales add column sale_discount_amount numeric not null default 0
  check (sale_discount_amount >= 0);

-- Sale, manual Discount, and Loyalty (earn or redeem) are mutually
-- exclusive -- at most one ever reduces a given sale's total, whether or
-- not a Sale is currently running. This changes 0030's behavior, which
-- let a manual Discount and Loyalty coexist on the same sale.
create or replace function record_sale(
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
  v_product_id uuid;
  v_total numeric := 0;
  v_profile_id uuid;
  v_sale_enabled boolean;
  v_sale_percent numeric;
  v_sale_scope text;
  v_sale_starts_at timestamptz;
  v_sale_ends_at timestamptz;
  v_sale_active boolean;
  v_sale_qualifies boolean;
  v_sale_discount numeric := 0;
  v_promo_applied boolean;
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

  -- Read the branch's Sale config once, before the item loop. No separate
  -- is_sale_active() SQL function -- this boolean has exactly one caller.
  select sale_enabled, sale_percent, sale_scope, sale_starts_at, sale_ends_at
    into v_sale_enabled, v_sale_percent, v_sale_scope, v_sale_starts_at, v_sale_ends_at
    from shops where id = p_shop_id;

  v_sale_active := coalesce(v_sale_enabled, false)
    and (v_sale_starts_at is null or now() >= v_sale_starts_at)
    and (v_sale_ends_at is null or now() <= v_sale_ends_at);

  for v_item in select * from jsonb_array_elements(items)
  loop
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid quantity for variant %', v_variant_id;
    end if;

    select price, cost, stock_qty, product_id into v_price, v_cost, v_stock, v_product_id
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

    if v_sale_active then
      v_sale_qualifies := v_sale_scope = 'branch' or exists (
        select 1 from sale_promo_products spp
        where spp.shop_id = p_shop_id and spp.product_id = v_product_id
      );
      if v_sale_qualifies then
        v_sale_discount := v_sale_discount + round(v_price * v_quantity * v_sale_percent / 100, 2);
      end if;
    end if;

    v_total := v_total + (v_price * v_quantity);
  end loop;

  -- An item-scoped Sale with no qualifying line in THIS cart
  -- (v_sale_discount = 0) doesn't count as "a Sale happened" and falls
  -- through to the manual-discount/loyalty path below like normal.
  if v_sale_active and v_sale_discount > 0 then
    if p_discount_amount > 0 then
      raise exception 'a manual discount cannot be combined with an active sale';
    end if;
    if p_loyalty_use_credit then
      raise exception 'loyalty credit cannot be used during an active sale';
    end if;
    v_total := v_total - v_sale_discount;
  elsif p_discount_amount > 0 then
    if p_loyalty_use_credit then
      raise exception 'loyalty credit cannot be combined with a manual discount';
    end if;
    if p_discount_amount > v_total then
      raise exception 'discount exceeds sale subtotal';
    end if;
    v_total := v_total - p_discount_amount;
  end if;

  -- True whenever THIS sale's total was actually reduced by the Sale or a
  -- manual discount -- either one fully disables loyalty below (no
  -- attach, no earn, no redeem; credit_balance untouched, so it "retains
  -- the credit" once the sale/discount period ends).
  v_promo_applied := (v_sale_active and v_sale_discount > 0) or p_discount_amount > 0;

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

  if v_promo_applied then
    v_loyalty_phone := null;
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
    sale_discount_amount = v_sale_discount,
    loyalty_customer_id = v_customer_id,
    loyalty_credit_redeemed = v_loyalty_redeemed,
    loyalty_credit_earned = v_loyalty_earned,
    loyalty_credit_forfeited = v_loyalty_forfeited
    where id = v_sale_id;

  return v_sale_id;
end;
$$;
