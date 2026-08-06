-- Cash Flow: per-branch daily cash sessions (starting cash / end-of-day
-- count + variance), a mid-day cash-in/cash-out ledger (including
-- branch-to-branch transfers, recorded as two independent entries rather
-- than one shared record -- see cash_movements below), and an owner-level
-- "floating cash" pool shared across every branch the owner runs.
--
-- Write access goes entirely through the RPCs below (open_cash_session,
-- close_cash_session, record_cash_movement, record_floating_cash_movement),
-- the same RPC-only pattern already used for sales/sale_items/stock_receipts
-- (0015_multi_shop_ownership.sql) -- those tables only ever get a SELECT
-- policy, never INSERT/UPDATE/DELETE, because SECURITY DEFINER functions
-- do their own is_member_of()/is_owner() checks and don't rely on RLS for
-- the write path. New functions created after this migration automatically
-- get EXECUTE granted to authenticated/service_role only (not PUBLIC), via
-- the ALTER DEFAULT PRIVILEGES already set up in 0037_qa_audit_fixes.sql --
-- no explicit GRANT statements needed here.

create table cash_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  business_date date not null,
  opening_cash numeric(12,2) not null check (opening_cash >= 0),
  opened_by uuid references profiles (id) on delete set null,
  opened_at timestamptz not null default now(),
  closing_cash numeric(12,2) check (closing_cash >= 0),
  expected_cash numeric(12,2),
  variance numeric(12,2),
  note text,
  closed_by uuid references profiles (id) on delete set null,
  closed_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  unique (shop_id, business_date)
);
create index cash_sessions_shop_id_idx on cash_sessions (shop_id);

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  cash_session_id uuid not null references cash_sessions (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  movement_type text not null default 'general'
    check (movement_type in ('general', 'branch_transfer', 'floating_pool')),
  amount numeric(12,2) not null check (amount > 0),
  counterparty_shop_id uuid references shops (id) on delete set null,
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index cash_movements_shop_id_idx on cash_movements (shop_id);
create index cash_movements_session_id_idx on cash_movements (cash_session_id);

-- Keyed by owner_user_id directly (not "the founding owner of shop X" the
-- way loyalty_customers resolves it in 0026_loyalty_program.sql) -- loyalty
-- needs that indirection because a sale only knows a shop_id, not which
-- owner is involved. Here the actor is always a logged-in owner working
-- their own pool, so auth.uid() is already the right key.
create table floating_cash_movements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  counterparty_shop_id uuid references shops (id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index floating_cash_movements_owner_user_id_idx on floating_cash_movements (owner_user_id);

alter table cash_sessions enable row level security;
alter table cash_movements enable row level security;
alter table floating_cash_movements enable row level security;

create policy "cash_sessions_select" on cash_sessions for select
  using (is_member_of(shop_id));
create policy "cash_movements_select" on cash_movements for select
  using (is_member_of(shop_id));
create policy "floating_cash_movements_select" on floating_cash_movements for select
  using (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- open_cash_session: starts today's register. The unique (shop_id,
-- business_date) constraint is what actually enforces "one session per
-- branch per day" -- caught here and turned into a friendlier message.
-- ---------------------------------------------------------------------
create function open_cash_session(p_shop_id uuid, p_opening_cash numeric, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_profile_id uuid;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;
  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception 'starting cash must be zero or more';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  insert into cash_sessions (shop_id, business_date, opening_cash, opened_by, note)
    values (
      p_shop_id, (now() at time zone 'utc')::date, p_opening_cash, v_profile_id,
      nullif(trim(coalesce(p_note, '')), '')
    )
    returning id into v_session_id;

  return v_session_id;
exception
  when unique_violation then
    raise exception 'the register is already open today';
end;
$$;

-- ---------------------------------------------------------------------
-- close_cash_session: computes expected_cash server-side (never trust a
-- client-submitted expected total) as opening + today's cash sales (not
-- voided) + cash-in - cash-out for this session, then records the
-- variance against the counted closing_cash.
-- ---------------------------------------------------------------------
create function close_cash_session(p_shop_id uuid, p_closing_cash numeric, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session cash_sessions%rowtype;
  v_profile_id uuid;
  v_cash_sales numeric;
  v_cash_in numeric;
  v_cash_out numeric;
  v_expected numeric;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;
  if p_closing_cash is null or p_closing_cash < 0 then
    raise exception 'closing cash must be zero or more';
  end if;

  select * into v_session
    from cash_sessions
    where shop_id = p_shop_id and business_date = (now() at time zone 'utc')::date and status = 'open'
    for update;

  if not found then
    raise exception 'no open register found for today';
  end if;

  v_day_start := v_session.business_date::timestamp at time zone 'utc';
  v_day_end := (v_session.business_date + 1)::timestamp at time zone 'utc';

  select coalesce(sum(total), 0) into v_cash_sales
    from sales
    where shop_id = p_shop_id
      and payment_method = 'cash'
      and voided_at is null
      and created_at >= v_day_start
      and created_at < v_day_end;

  select
      coalesce(sum(amount) filter (where direction = 'in'), 0),
      coalesce(sum(amount) filter (where direction = 'out'), 0)
    into v_cash_in, v_cash_out
    from cash_movements
    where cash_session_id = v_session.id;

  v_expected := v_session.opening_cash + v_cash_sales + v_cash_in - v_cash_out;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  update cash_sessions set
    closing_cash = p_closing_cash,
    expected_cash = v_expected,
    variance = p_closing_cash - v_expected,
    note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note),
    closed_by = v_profile_id,
    closed_at = now(),
    status = 'closed'
    where id = v_session.id;

  return v_session.id;
end;
$$;

-- ---------------------------------------------------------------------
-- record_cash_movement: the general Cash In/Cash Out entry point. Staff
-- can only use movement_type='general'; 'branch_transfer' and
-- 'floating_pool' are owner-only. counterparty_shop_id is descriptive
-- metadata for reporting only -- a branch-to-branch transfer is two
-- independent calls to this function (one per branch), not one shared
-- record, per how the owner wants it tracked.
-- ---------------------------------------------------------------------
create function record_cash_movement(
  p_shop_id uuid,
  p_direction text,
  p_amount numeric,
  p_movement_type text default 'general',
  p_counterparty_shop_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement_id uuid;
  v_profile_id uuid;
  v_session_id uuid;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;
  if p_direction not in ('in', 'out') then
    raise exception 'invalid direction';
  end if;
  if p_movement_type not in ('general', 'branch_transfer', 'floating_pool') then
    raise exception 'invalid movement type';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_movement_type <> 'general' and not is_owner(p_shop_id) then
    raise exception 'only an owner can record a branch transfer or floating cash movement';
  end if;
  if p_counterparty_shop_id is not null
     and not exists (select 1 from shops where id = p_counterparty_shop_id) then
    raise exception 'counterparty branch not found';
  end if;

  select id into v_session_id
    from cash_sessions
    where shop_id = p_shop_id and business_date = (now() at time zone 'utc')::date and status = 'open';

  if v_session_id is null then
    raise exception 'open the register before recording cash movements';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  insert into cash_movements (
    shop_id, cash_session_id, direction, movement_type, amount, counterparty_shop_id, note, created_by
  )
    values (
      p_shop_id, v_session_id, p_direction, p_movement_type, p_amount, p_counterparty_shop_id,
      nullif(trim(coalesce(p_note, '')), ''), v_profile_id
    )
    returning id into v_movement_id;

  return v_movement_id;
end;
$$;

-- ---------------------------------------------------------------------
-- record_floating_cash_movement: owner-only, always acts as auth.uid()
-- (never a p_owner_user_id parameter -- a public RPC taking an arbitrary
-- owner id would let anyone deposit/withdraw against someone else's pool
-- by guessing/enumerating ids, the same reasoning 0026_loyalty_program.sql
-- gives for not factoring its founding-owner lookup into a callable
-- function). created_by is attributed to the caller's earliest owner
-- profile row, since a pool action isn't tied to one specific branch.
-- ---------------------------------------------------------------------
create function record_floating_cash_movement(
  p_direction text,
  p_amount numeric,
  p_counterparty_shop_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement_id uuid;
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_direction not in ('in', 'out') then
    raise exception 'invalid direction';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_counterparty_shop_id is not null and not is_owner(p_counterparty_shop_id) then
    raise exception 'you must own the counterparty branch';
  end if;

  select id into v_profile_id
    from profiles
    where user_id = auth.uid() and role = 'owner'
    order by created_at asc
    limit 1;

  if v_profile_id is null then
    raise exception 'only an owner can manage the floating cash pool';
  end if;

  insert into floating_cash_movements (owner_user_id, direction, counterparty_shop_id, amount, note, created_by)
    values (auth.uid(), p_direction, p_counterparty_shop_id, p_amount, nullif(trim(coalesce(p_note, '')), ''), v_profile_id)
    returning id into v_movement_id;

  return v_movement_id;
end;
$$;

-- ---------------------------------------------------------------------
-- record_sale: unchanged except for one added guard right after the
-- existing payment-method/discount checks -- a sale can't be recorded
-- for a branch whose register isn't open today. Full body otherwise
-- identical to 0037_qa_audit_fixes.sql.
-- ---------------------------------------------------------------------
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

  if not exists (
    select 1 from cash_sessions
    where shop_id = p_shop_id
      and business_date = (now() at time zone 'utc')::date
      and status = 'open'
  ) then
    raise exception 'open the register before recording a sale';
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
