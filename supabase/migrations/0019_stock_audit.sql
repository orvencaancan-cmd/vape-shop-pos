-- Stock audits: a physical count session compared against system stock.
-- Open to any shop member (owner or staff) -- unlike variants, which staff
-- can't update directly, so applying the counted differences goes through
-- confirm_stock_audit() below rather than a direct RLS-gated update.

create table stock_audits (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  started_by uuid references profiles (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_by uuid references profiles (id) on delete set null,
  completed_at timestamptz
);
create index stock_audits_shop_id_idx on stock_audits (shop_id);

create table stock_audit_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  audit_id uuid not null references stock_audits (id) on delete cascade,
  variant_id uuid not null references variants (id) on delete cascade,
  system_qty integer not null,
  counted_qty integer not null,
  created_at timestamptz not null default now(),
  unique (audit_id, variant_id)
);
create index stock_audit_lines_audit_id_idx on stock_audit_lines (audit_id);

alter table stock_audits enable row level security;
alter table stock_audit_lines enable row level security;

create policy "stock_audits_select" on stock_audits for select
  using (is_member_of(shop_id));
create policy "stock_audits_insert" on stock_audits for insert
  with check (is_member_of(shop_id));

create policy "stock_audit_lines_select" on stock_audit_lines for select
  using (is_member_of(shop_id));
create policy "stock_audit_lines_insert" on stock_audit_lines for insert
  with check (is_member_of(shop_id));
create policy "stock_audit_lines_update" on stock_audit_lines for update
  using (is_member_of(shop_id))
  with check (is_member_of(shop_id));
create policy "stock_audit_lines_delete" on stock_audit_lines for delete
  using (is_member_of(shop_id));

create function confirm_stock_audit(p_shop_id uuid, p_audit_id uuid)
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
    select variant_id, counted_qty from stock_audit_lines
    where audit_id = p_audit_id and shop_id = p_shop_id
  loop
    update variants set stock_qty = v_line.counted_qty
      where id = v_line.variant_id and shop_id = p_shop_id;
  end loop;

  update stock_audits set completed_at = now(), completed_by = v_profile_id
    where id = p_audit_id;
end;
$$;
