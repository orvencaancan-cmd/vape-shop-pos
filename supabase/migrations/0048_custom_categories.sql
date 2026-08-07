-- Lets an owner define their own product categories beyond the fixed set in
-- src/lib/inventory/product-categories.ts (Cartridge, Flavor Pod, Device,
-- Pod Device, Wire, Cotton, Other). Business-wide like loyalty_customers --
-- owner_user_id-scoped, visible to every branch the owner has, managed by
-- the owner only.
--
-- A custom category's optional variant "tag" (the owner's own example:
-- relabeling what would've been "Flavor" as "Size") always reuses the
-- existing generic variants.size text column -- the same slot Device
-- ("Color") and Wire ("Gauge") already repurpose today. variants.ohms
-- stays reserved for the built-in Cartridge category; a numeric custom tag
-- isn't supported here since nothing has asked for one yet.

create table custom_categories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  variant_label text,
  variant_input_type text check (variant_input_type in ('checklist', 'freeText')),
  variant_options jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index custom_categories_owner_user_id_idx on custom_categories (owner_user_id);

alter table custom_categories enable row level security;

-- Read access follows the same "member of the owner's business" rule as
-- loyalty_customers (0026_loyalty_program.sql) -- every branch's staff can
-- see the category list when adding products, not just the owner.
create policy "custom_categories_select" on custom_categories for select
  using (is_member_of_owner_business(owner_user_id) or is_platform_admin());

-- Deliberately no insert/update/delete policy for authenticated/anon --
-- same reasoning as loyalty_customers: all mutation happens inside the
-- security definer RPCs below, which resolve owner_user_id server-side
-- instead of trusting a client-supplied value.

create function create_custom_category(
  p_shop_id uuid,
  p_label text,
  p_variant_label text default null,
  p_variant_input_type text default null,
  p_variant_options jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_label text;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not is_owner(p_shop_id) then
    raise exception 'only the owner can add a category';
  end if;

  v_label := trim(coalesce(p_label, ''));
  if v_label = '' then
    raise exception 'category name is required';
  end if;
  if lower(v_label) in (
    'ejuice', 'e-juice', 'cartridge', 'flavor pod', 'device', 'pod device', 'wire', 'cotton', 'other'
  ) then
    raise exception '"%" is already a built-in category', v_label;
  end if;

  if p_variant_input_type is not null and p_variant_input_type not in ('checklist', 'freeText') then
    raise exception 'invalid tag type';
  end if;
  if p_variant_input_type = 'checklist' and (p_variant_options is null or jsonb_array_length(p_variant_options) = 0) then
    raise exception 'add at least one option for the tag';
  end if;

  select user_id into v_owner_user_id
    from profiles
    where shop_id = p_shop_id and role = 'owner'
    order by created_at asc
    limit 1;
  if v_owner_user_id is null then
    raise exception 'could not resolve the shop owner';
  end if;

  if exists (
    select 1 from custom_categories
    where owner_user_id = v_owner_user_id and archived = false and lower(label) = lower(v_label)
  ) then
    raise exception 'you already have a category named "%"', v_label;
  end if;

  insert into custom_categories (owner_user_id, label, variant_label, variant_input_type, variant_options)
    values (
      v_owner_user_id,
      v_label,
      nullif(trim(coalesce(p_variant_label, '')), ''),
      p_variant_input_type,
      case when p_variant_input_type = 'checklist' then p_variant_options else null end
    )
    returning id into v_new_id;

  return v_new_id;
end;
$$;

create function archive_custom_category(p_shop_id uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not is_owner(p_shop_id) then
    raise exception 'only the owner can archive a category';
  end if;

  select user_id into v_owner_user_id
    from profiles
    where shop_id = p_shop_id and role = 'owner'
    order by created_at asc
    limit 1;

  update custom_categories set archived = true
    where id = p_id and owner_user_id = v_owner_user_id;
end;
$$;

-- The enumerated 8-value category CHECK constraints added in
-- 0047_product_categories.sql can no longer be exhaustive -- custom
-- category names vary per owner, and a CHECK constraint can't subquery
-- custom_categories. Same dynamic-lookup-and-drop technique as 0047 (these
-- constraints were named explicitly there, but this stays defensive in
-- case that ever changes), replaced with a light non-empty check. Real
-- category legitimacy is enforced where products are inserted instead --
-- the same trust level already given to brand/description, which have
-- never had DB-level validation.
do $$
declare
  r record;
begin
  for r in
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where contype = 'c'
      and conrelid in ('products'::regclass, 'floating_products'::regclass, 'inventory_transfer_lines'::regclass)
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table products add constraint products_category_check check (length(trim(category)) > 0);
alter table floating_products add constraint floating_products_category_check check (length(trim(category)) > 0);
alter table inventory_transfer_lines add constraint inventory_transfer_lines_category_check
  check (length(trim(category)) > 0);
