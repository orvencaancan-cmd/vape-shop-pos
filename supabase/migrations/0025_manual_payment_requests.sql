-- Manual GCash/Maya subscription payments: PayMongo's automated recurring
-- billing is Maya-and-card only and gated behind business verification we
-- don't have yet, so owners pay by scanning a QR code and submitting a
-- reference number, which a platform admin reviews and approves by hand.
-- Approval writes to shops.subscription_status/current_period_end, which
-- (per 0022) only the service-role admin client may touch -- enforced here
-- by never granting update on this table to the regular client either;
-- approve/reject always goes through the admin client in a server action.

create table manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  method text not null check (method in ('gcash', 'maya')),
  amount numeric not null check (amount > 0),
  reference_note text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz
);
create index manual_payment_requests_shop_id_idx on manual_payment_requests (shop_id);
create index manual_payment_requests_status_idx on manual_payment_requests (status);

alter table manual_payment_requests enable row level security;

create policy "manual_payment_requests_select" on manual_payment_requests
  for select using (is_member_of(shop_id) or is_platform_admin());
create policy "manual_payment_requests_insert" on manual_payment_requests
  for insert with check (is_member_of(shop_id) and is_owner(shop_id));
