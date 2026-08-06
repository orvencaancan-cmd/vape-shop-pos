-- Cash transfers: cash moving between a branch and the floating pool, or
-- between two branches, is physically carried by hand -- there's a real
-- gap between "I took this out" and "the other side actually has it".
-- Previously Cash Out / Withdraw (movement_type in ('branch_transfer',
-- 'floating_pool')) immediately debited the source, which let money
-- vanish from the system during that gap (or get fabricated if the
-- receiving side just logged its own free-standing Cash In without a
-- matching source entry ever existing). This migration replaces that
-- outgoing path with a pending cash_transfers row: nothing moves on
-- either side's books until the destination explicitly receives it via
-- receive_cash_transfer, which writes both ledger entries atomically in
-- one transaction. record_cash_movement/record_floating_cash_movement
-- are locked down below to reject anything but a same-side 'general'
-- entry -- the only way cash now crosses branches/pool is through a
-- transfer that both sides touched.

create table cash_transfers (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('branch', 'floating')),
  source_shop_id uuid references shops (id) on delete cascade,
  destination_type text not null check (destination_type in ('branch', 'floating')),
  destination_shop_id uuid references shops (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  status text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  -- The owner who initiated it -- always the same person on both ends
  -- since only an owner can create a transfer and both branch endpoints
  -- (if any) must pass is_owner() for that same auth.uid(). This is what
  -- floating-pool endpoints are scoped by, the same way
  -- floating_cash_movements.owner_user_id already works.
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  initiated_by uuid references profiles (id) on delete set null,
  received_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  cancelled_at timestamptz,
  check (
    (source_type = 'branch' and source_shop_id is not null) or
    (source_type = 'floating' and source_shop_id is null)
  ),
  check (
    (destination_type = 'branch' and destination_shop_id is not null) or
    (destination_type = 'floating' and destination_shop_id is null)
  ),
  check (source_type <> destination_type or source_shop_id is distinct from destination_shop_id)
);
create index cash_transfers_source_shop_id_idx on cash_transfers (source_shop_id);
create index cash_transfers_destination_shop_id_idx on cash_transfers (destination_shop_id);
create index cash_transfers_owner_user_id_idx on cash_transfers (owner_user_id);
create index cash_transfers_status_idx on cash_transfers (status);

alter table cash_transfers enable row level security;

-- Visible to the owner who sent it (business-wide, matches
-- floating_cash_movements) and to anyone on staff at either endpoint --
-- a branch's own staff should see cash awaiting them, or that they sent,
-- without needing the owner role.
create policy "cash_transfers_select" on cash_transfers for select
  using (
    owner_user_id = auth.uid()
    or (source_shop_id is not null and is_member_of(source_shop_id))
    or (destination_shop_id is not null and is_member_of(destination_shop_id))
  );

-- ---------------------------------------------------------------------
-- create_cash_transfer: owner-only (matches record_cash_movement's
-- existing owner-only gate on branch_transfer/floating_pool types).
-- Doesn't touch any balance -- the amount stays counted at the source
-- until receive_cash_transfer runs. A branch source must have its
-- register open today, same requirement Cash Out already has.
-- ---------------------------------------------------------------------
create function create_cash_transfer(
  p_source_type text,
  p_source_shop_id uuid,
  p_destination_type text,
  p_destination_shop_id uuid,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_id uuid;
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_source_type not in ('branch', 'floating') or p_destination_type not in ('branch', 'floating') then
    raise exception 'invalid transfer endpoint';
  end if;
  if p_source_type = 'branch' and p_source_shop_id is null then
    raise exception 'source branch is required';
  end if;
  if p_destination_type = 'branch' and p_destination_shop_id is null then
    raise exception 'destination branch is required';
  end if;
  if p_source_type = 'floating' then
    p_source_shop_id := null;
  end if;
  if p_destination_type = 'floating' then
    p_destination_shop_id := null;
  end if;
  if p_source_type = p_destination_type and p_source_shop_id is not distinct from p_destination_shop_id then
    raise exception 'source and destination must be different';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_source_type = 'branch' and not is_owner(p_source_shop_id) then
    raise exception 'you must own the source branch';
  end if;
  if p_destination_type = 'branch' and not is_owner(p_destination_shop_id) then
    raise exception 'you must own the destination branch';
  end if;
  if p_source_type = 'branch' and not exists (
    select 1 from cash_sessions
    where shop_id = p_source_shop_id and business_date = (now() at time zone 'utc')::date and status = 'open'
  ) then
    raise exception 'open the source branch''s register before sending cash out';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() order by created_at asc limit 1;

  insert into cash_transfers (
    source_type, source_shop_id, destination_type, destination_shop_id, amount, note,
    owner_user_id, initiated_by
  ) values (
    p_source_type, p_source_shop_id, p_destination_type, p_destination_shop_id, p_amount,
    nullif(trim(coalesce(p_note, '')), ''), auth.uid(), v_profile_id
  )
  returning id into v_transfer_id;

  return v_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- receive_cash_transfer: the only place a transfer's amount actually
-- moves. Callable by any member of the destination branch (receiving is
-- just confirming cash you're already holding, not a trust decision --
-- the risk was already gated at creation time). Writes the destination's
-- 'in' entry and the source's 'out' entry in the same transaction, so
-- there's never a moment where the money exists on neither side or both.
-- ---------------------------------------------------------------------
create function receive_cash_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer cash_transfers%rowtype;
  v_receiver_profile_id uuid;
  v_dest_session_id uuid;
  v_source_session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_transfer from cash_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'transfer not found';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'this transfer is no longer pending';
  end if;

  if v_transfer.destination_type = 'branch' then
    if not is_member_of(v_transfer.destination_shop_id) then
      raise exception 'not authenticated as a member of the destination branch';
    end if;

    select id into v_dest_session_id
      from cash_sessions
      where shop_id = v_transfer.destination_shop_id
        and business_date = (now() at time zone 'utc')::date and status = 'open';
    if v_dest_session_id is null then
      raise exception 'open the register before receiving cash';
    end if;

    select id into v_receiver_profile_id
      from profiles where user_id = auth.uid() and shop_id = v_transfer.destination_shop_id;

    insert into cash_movements (
      shop_id, cash_session_id, direction, movement_type, amount, counterparty_shop_id, note, created_by
    ) values (
      v_transfer.destination_shop_id, v_dest_session_id, 'in',
      case when v_transfer.source_type = 'floating' then 'floating_pool' else 'branch_transfer' end,
      v_transfer.amount, v_transfer.source_shop_id,
      coalesce(v_transfer.note, 'Received transfer'), v_receiver_profile_id
    );
  else
    if v_transfer.owner_user_id <> auth.uid() then
      raise exception 'only the owner can receive cash into the floating pool';
    end if;

    select id into v_receiver_profile_id
      from profiles where user_id = auth.uid() and role = 'owner' order by created_at asc limit 1;

    insert into floating_cash_movements (owner_user_id, direction, counterparty_shop_id, amount, note, created_by)
      values (
        auth.uid(), 'in', v_transfer.source_shop_id, v_transfer.amount,
        coalesce(v_transfer.note, 'Received transfer'), v_receiver_profile_id
      );
  end if;

  if v_transfer.source_type = 'branch' then
    select id into v_source_session_id
      from cash_sessions
      where shop_id = v_transfer.source_shop_id
        and business_date = (now() at time zone 'utc')::date and status = 'open';
    if v_source_session_id is null then
      raise exception 'the source branch''s register is no longer open today -- ask them to reopen before this can be received';
    end if;

    insert into cash_movements (
      shop_id, cash_session_id, direction, movement_type, amount, counterparty_shop_id, note, created_by
    ) values (
      v_transfer.source_shop_id, v_source_session_id, 'out',
      case when v_transfer.destination_type = 'floating' then 'floating_pool' else 'branch_transfer' end,
      v_transfer.amount, v_transfer.destination_shop_id,
      coalesce(v_transfer.note, 'Sent transfer'), v_transfer.initiated_by
    );
  else
    insert into floating_cash_movements (owner_user_id, direction, counterparty_shop_id, amount, note, created_by)
      values (
        v_transfer.owner_user_id, 'out', v_transfer.destination_shop_id, v_transfer.amount,
        coalesce(v_transfer.note, 'Sent transfer'), v_transfer.initiated_by
      );
  end if;

  update cash_transfers set
    status = 'received', received_by = v_receiver_profile_id, received_at = now()
    where id = p_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- cancel_cash_transfer: lets the sender undo a mistaken transfer before
-- anyone's received it. Owner-only, same as creation.
-- ---------------------------------------------------------------------
create function cancel_cash_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer cash_transfers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_transfer from cash_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'transfer not found';
  end if;
  if v_transfer.owner_user_id <> auth.uid() then
    raise exception 'only the owner who sent this transfer can cancel it';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'this transfer is no longer pending';
  end if;

  update cash_transfers set status = 'cancelled', cancelled_at = now() where id = p_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- record_cash_movement: branch_transfer/floating_pool now only ever get
-- written by receive_cash_transfer (which inserts directly, bypassing
-- this function's own checks by design -- it's already SECURITY DEFINER
-- validating its own transfer row). This RPC is the manual/client-facing
-- entry point, so it's tightened to 'general' only -- a caller can no
-- longer materialize an 'in' movement by just picking a source out of
-- thin air, which was the original fabrication concern.
-- ---------------------------------------------------------------------
create or replace function record_cash_movement(
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
  if p_movement_type <> 'general' then
    raise exception 'branch transfers and floating cash now go through create_cash_transfer / receive_cash_transfer';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select id into v_session_id
    from cash_sessions
    where shop_id = p_shop_id and business_date = (now() at time zone 'utc')::date and status = 'open';

  if v_session_id is null then
    raise exception 'open the register before recording cash movements';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  insert into cash_movements (shop_id, cash_session_id, direction, movement_type, amount, note, created_by)
    values (
      p_shop_id, v_session_id, p_direction, 'general', p_amount,
      nullif(trim(coalesce(p_note, '')), ''), v_profile_id
    )
    returning id into v_movement_id;

  return v_movement_id;
end;
$$;

-- ---------------------------------------------------------------------
-- record_floating_cash_movement: same tightening -- a branch-linked
-- deposit/withdrawal now only happens via create_cash_transfer /
-- receive_cash_transfer, so a counterparty_shop_id is no longer accepted
-- here. Deposit/Withdraw stay available for cash genuinely entering or
-- leaving the tracked system from outside (the owner's own pocket, a
-- bank run) with no in-app counterparty.
-- ---------------------------------------------------------------------
create or replace function record_floating_cash_movement(
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
  if p_counterparty_shop_id is not null then
    raise exception 'branch-linked floating cash now goes through create_cash_transfer / receive_cash_transfer';
  end if;

  select id into v_profile_id
    from profiles
    where user_id = auth.uid() and role = 'owner'
    order by created_at asc
    limit 1;

  if v_profile_id is null then
    raise exception 'only an owner can manage the floating cash pool';
  end if;

  insert into floating_cash_movements (owner_user_id, direction, amount, note, created_by)
    values (auth.uid(), p_direction, p_amount, nullif(trim(coalesce(p_note, '')), ''), v_profile_id)
    returning id into v_movement_id;

  return v_movement_id;
end;
$$;
