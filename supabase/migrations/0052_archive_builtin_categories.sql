-- Lets an owner archive a built-in category (Cartridge, Flavor Pod, Device,
-- Pod Device, Wire, Cotton) the same way custom categories can already be
-- archived. Built-ins have no DB row of their own -- they're defined in
-- src/lib/inventory/product-categories.ts -- so archiving one just needs a
-- per-owner "hide this key" marker rather than an update on an existing row.
create table archived_builtin_categories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  category_key text not null,
  archived_at timestamptz not null default now(),
  unique (owner_user_id, category_key)
);
create index archived_builtin_categories_owner_user_id_idx on archived_builtin_categories (owner_user_id);

alter table archived_builtin_categories enable row level security;

-- Same "member of the owner's business" read rule custom_categories uses --
-- every branch's staff sees which built-ins are hidden when adding products,
-- not just the owner.
create policy "archived_builtin_categories_select" on archived_builtin_categories for select
  using (is_member_of_owner_business(owner_user_id) or is_platform_admin());

-- Deliberately no insert/update/delete policy -- mutated only via
-- archive_builtin_category below, same reasoning custom_categories uses.

create function archive_builtin_category(p_shop_id uuid, p_category_key text, p_category_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_stock_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not is_owner(p_shop_id) then
    raise exception 'only the owner can archive a category';
  end if;
  if p_category_key is null or trim(p_category_key) = '' then
    raise exception 'invalid category';
  end if;

  select user_id into v_owner_user_id
    from profiles
    where shop_id = p_shop_id and role = 'owner'
    order by created_at asc
    limit 1;

  -- No stock anywhere under this category -- every branch this owner has,
  -- plus the floating pool -- or archiving would hide a category that's
  -- still actively holding real inventory.
  select count(*) into v_stock_count
    from variants v
    join products p on p.id = v.product_id
    where v.shop_id in (select shop_id from profiles where user_id = v_owner_user_id and role = 'owner')
      and p.archived = false
      and lower(p.category) = lower(p_category_label)
      and v.stock_qty > 0;
  if v_stock_count = 0 then
    select count(*) into v_stock_count
      from floating_variants fv
      join floating_products fp on fp.id = fv.product_id
      where fp.owner_user_id = v_owner_user_id
        and fp.archived = false
        and lower(fp.category) = lower(p_category_label)
        and fv.stock_qty > 0;
  end if;
  if v_stock_count > 0 then
    raise exception 'this category still has stock -- move or sell it out first';
  end if;

  insert into archived_builtin_categories (owner_user_id, category_key)
    values (v_owner_user_id, p_category_key)
    on conflict (owner_user_id, category_key) do nothing;
end;
$$;

-- archive_custom_category: adds the same "no stock anywhere" guard
-- archive_builtin_category enforces above -- previously a custom category
-- could be archived while still holding real stock, hiding it from the
-- picker with no way back to it short of re-creating the category by hand.
create or replace function archive_custom_category(p_shop_id uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_label text;
  v_stock_count integer;
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

  select label into v_label from custom_categories where id = p_id and owner_user_id = v_owner_user_id;
  if v_label is null then
    raise exception 'category not found';
  end if;

  select count(*) into v_stock_count
    from variants v
    join products p on p.id = v.product_id
    where v.shop_id in (select shop_id from profiles where user_id = v_owner_user_id and role = 'owner')
      and p.archived = false
      and lower(p.category) = lower(v_label)
      and v.stock_qty > 0;
  if v_stock_count = 0 then
    select count(*) into v_stock_count
      from floating_variants fv
      join floating_products fp on fp.id = fv.product_id
      where fp.owner_user_id = v_owner_user_id
        and fp.archived = false
        and lower(fp.category) = lower(v_label)
        and fv.stock_qty > 0;
  end if;
  if v_stock_count > 0 then
    raise exception 'this category still has stock -- move or sell it out first';
  end if;

  update custom_categories set archived = true
    where id = p_id and owner_user_id = v_owner_user_id;
end;
$$;
