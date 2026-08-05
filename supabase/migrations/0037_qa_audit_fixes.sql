-- Batch of fixes from a QA/architecture audit (2026-08-05):
--   1. void_sale regression: 0035's drop/recreate (to add the required-
--      reason param) silently dropped the loyalty-credit-restoration block
--      that 0026/0030 had added -- voiding a sale that redeemed or earned
--      loyalty credit no longer touched the customer's balance. Restored.
--   2. record_sale: added an explanatory comment (no behavior change) on
--      why the loyalty_customers upsert doesn't need an extra explicit
--      lock -- flagged as a possible race in the audit, but INSERT ...
--      ON CONFLICT DO UPDATE already takes a row lock on the conflicting
--      row for the rest of the transaction, which already serializes
--      concurrent redemptions against the same phone number correctly.
--      Documented inline so a future refactor doesn't accidentally split
--      this into a separate SELECT + UPDATE and reintroduce a real race.
--   3. confirm_stock_audit: was a direct overwrite (stock_qty =
--      counted_qty), which silently clobbers any stock movement (e.g. a
--      sale) that happened between when a line was counted and when the
--      audit was confirmed. Changed to apply the counted discrepancy as a
--      delta against current stock instead.
--   4. Missing FK indexes: sale_items.variant_id, stock_audit_lines.
--      variant_id, products.supplier_id, sale_promo_products.product_id.
--   5. Currency columns had no scale constraint (bare `numeric`, unbounded
--      decimal places). Verified no existing row has more than 2 decimal
--      places, then locked them to numeric(12,2).
--   6. No RPC in this project has ever revoked Postgres's default
--      EXECUTE-to-PUBLIC grant -- every one of them happens to self-check
--      is_member_of/is_owner, so this hasn't been exploitable, but it's a
--      single missed check away from being one. Revoked PUBLIC execute on
--      every function (including future ones, via ALTER DEFAULT
--      PRIVILEGES) and explicitly re-granted to authenticated/service_role
--      only -- no RPC in this app is ever meant to be callable by a
--      signed-out (anon) session.
--   7. search_loyalty_customers does a leading-wildcard ILIKE on
--      loyalty_customers.name, which a plain btree index can never use.
--      Added pg_trgm + a GIN index so it stops being an unindexed scan.

-- 1. Restore loyalty credit reversal in void_sale (same signature as 0035).
create or replace function void_sale(p_shop_id uuid, p_sale_id uuid, p_reason text default null)
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

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'a reason is required to void a sale';
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

  update sales set voided_at = now(), voided_by = v_profile_id, voided_reason = trim(p_reason)
    where id = p_sale_id;
end;
$$;

-- 2. record_sale: same logic as 0031, just with the safety comment added
-- around the loyalty_customers upsert.
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

    -- This INSERT ... ON CONFLICT DO UPDATE ... RETURNING takes an
    -- UPDATE-strength lock on the conflicting row (Postgres's documented
    -- upsert-concurrency guarantee), held until this transaction commits.
    -- A second concurrent record_sale call for the same owner_user_id +
    -- phone blocks here until this one finishes, then reads the
    -- post-commit credit_balance -- so two simultaneous redemptions for
    -- the same customer can't both read the same stale balance and
    -- over-redeem. Don't split this into a separate SELECT + UPDATE later
    -- without re-adding an explicit `for update` -- that would remove this
    -- guarantee.
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

-- 3. confirm_stock_audit: apply the counted discrepancy as a delta against
-- current stock instead of overwriting it outright, so a sale that happens
-- between counting a line and confirming the audit isn't silently erased.
create or replace function confirm_stock_audit(p_shop_id uuid, p_audit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_line record;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;

  if not exists (
    select 1 from stock_audits
    where id = p_audit_id and shop_id = p_shop_id and completed_at is null
  ) then
    raise exception 'audit not found or already completed';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  for v_line in
    select variant_id, system_qty, counted_qty from stock_audit_lines
    where audit_id = p_audit_id and shop_id = p_shop_id
  loop
    update variants set stock_qty = stock_qty + (v_line.counted_qty - v_line.system_qty)
      where id = v_line.variant_id and shop_id = p_shop_id;
  end loop;

  update stock_audits set completed_at = now(), completed_by = v_profile_id
    where id = p_audit_id;
end;
$$;

-- 4. Missing FK indexes.
create index if not exists sale_items_variant_id_idx on sale_items (variant_id);
create index if not exists stock_audit_lines_variant_id_idx on stock_audit_lines (variant_id);
create index if not exists products_supplier_id_idx on products (supplier_id);
create index if not exists sale_promo_products_product_id_idx on sale_promo_products (product_id);

-- 5. Currency column scale. Verified against live data first (all rows
-- already at <=2 decimal places) -- this is a constraint, not a backfill.
alter table variants alter column price type numeric(12,2);
alter table variants alter column cost type numeric(12,2);
alter table sales alter column total type numeric(12,2);
alter table sales alter column discount_amount type numeric(12,2);
alter table sales alter column sale_discount_amount type numeric(12,2);
alter table sales alter column loyalty_credit_redeemed type numeric(12,2);
alter table sales alter column loyalty_credit_earned type numeric(12,2);
alter table sales alter column loyalty_credit_forfeited type numeric(12,2);
alter table sale_items alter column unit_price type numeric(12,2);
alter table sale_items alter column unit_cost type numeric(12,2);
alter table loyalty_customers alter column credit_balance type numeric(12,2);
alter table expenses alter column amount type numeric(12,2);
alter table stock_receipts alter column unit_cost type numeric(12,2);

-- 6. Close the default EXECUTE-to-PUBLIC gap, for existing and future
-- functions. No RPC in this app is ever called by a signed-out session.
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- 7. search_loyalty_customers does a leading-wildcard ILIKE on `name`,
-- which a btree index can never serve -- pg_trgm + GIN makes it a real
-- index scan instead of a per-owner full scan.
create extension if not exists pg_trgm;
create index if not exists loyalty_customers_name_trgm_idx on loyalty_customers using gin (name gin_trgm_ops);
