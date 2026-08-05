-- Lets the shop owner directly correct a variant's stock count when it's
-- known to be wrong (e.g. miscounted during setup, damage never logged)
-- without running a full physical stock audit just to fix one item.
-- Owner-only, and a reason is required -- same required-reason pattern as
-- void_sale (0035_void_sale_reason.sql) -- so there's always an
-- explanation on file for why a number changed outside the normal
-- sell/receive/audit flows.

create table stock_corrections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  variant_id uuid not null references variants (id) on delete cascade,
  corrected_by uuid references profiles (id) on delete set null,
  previous_qty integer not null,
  new_qty integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index stock_corrections_shop_id_idx on stock_corrections (shop_id);
create index stock_corrections_variant_id_idx on stock_corrections (variant_id);

alter table stock_corrections enable row level security;

create policy "stock_corrections_select" on stock_corrections for select
  using (is_member_of(shop_id));
-- no insert/update/delete policy for authenticated/anon -- all writes
-- happen inside correct_stock() below (security definer), same pattern
-- as stock_audits/loyalty_customers.

create function correct_stock(
  p_shop_id uuid,
  p_variant_id uuid,
  p_new_qty integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_previous_qty integer;
begin
  if not is_owner(p_shop_id) then
    raise exception 'only the shop owner can correct stock';
  end if;
  if p_new_qty < 0 then
    raise exception 'stock cannot be negative';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'a reason is required to correct stock';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  select stock_qty into v_previous_qty
    from variants
    where id = p_variant_id and shop_id = p_shop_id
    for update;
  if not found then
    raise exception 'variant does not belong to this shop';
  end if;

  update variants set stock_qty = p_new_qty where id = p_variant_id;

  insert into stock_corrections (shop_id, variant_id, corrected_by, previous_qty, new_qty, reason)
    values (p_shop_id, p_variant_id, v_profile_id, v_previous_qty, p_new_qty, trim(p_reason));
end;
$$;

-- No explicit grant execute needed here -- 0037_qa_audit_fixes.sql's
-- ALTER DEFAULT PRIVILEGES already covers every function created from now
-- on, granting EXECUTE to authenticated/service_role and nobody else.
