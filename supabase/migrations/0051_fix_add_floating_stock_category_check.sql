-- add_floating_stock's category check (from 0047_product_categories.sql)
-- still hardcodes the fixed built-in list ('ejuice', 'Cartridge', 'Flavor
-- Pod', 'Device', 'Pod Device', 'Wire', 'Cotton', 'Other'), left over from
-- before custom categories existed. 0048_custom_categories.sql already
-- loosened the *column* constraint (floating_products_category_check) to
-- accept any non-empty category, matching products_category_check -- but
-- this function's own internal check was never updated to match, so every
-- custom category is still rejected with "invalid category" here, even
-- though the table itself would happily accept it. Recreated with the
-- same non-empty check the column already enforces (no signature change,
-- so create or replace is enough).

create or replace function add_floating_stock(
  p_category text,
  p_brand text,
  p_product_name text,
  p_flavor text default null,
  p_nicotine_mg numeric default null,
  p_size text default null,
  p_for_device text default null,
  p_ohms numeric default null,
  p_sku text default null,
  p_quantity integer default null,
  p_cost numeric default null,
  p_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_variant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_category is null or trim(p_category) = '' then
    raise exception 'category is required';
  end if;
  if p_product_name is null or trim(p_product_name) = '' then
    raise exception 'product name is required';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  select id into v_product_id
    from floating_products
    where owner_user_id = auth.uid()
      and category = p_category
      and archived = false
      and lower(trim(name)) = lower(trim(p_product_name))
      and coalesce(lower(trim(brand)), '') = coalesce(lower(trim(p_brand)), '')
    limit 1;

  if v_product_id is null then
    insert into floating_products (owner_user_id, name, category, brand)
      values (auth.uid(), trim(p_product_name), p_category, nullif(trim(coalesce(p_brand, '')), ''))
      returning id into v_product_id;
  end if;

  select id into v_variant_id
    from floating_variants
    where owner_user_id = auth.uid()
      and product_id = v_product_id
      and coalesce(lower(trim(flavor)), '') = coalesce(lower(trim(p_flavor)), '')
      and coalesce(nicotine_mg, -1) = coalesce(p_nicotine_mg, -1)
      and coalesce(lower(trim(size)), '') = coalesce(lower(trim(p_size)), '')
      and coalesce(lower(trim(for_device)), '') = coalesce(lower(trim(p_for_device)), '')
      and coalesce(ohms, -1) = coalesce(p_ohms, -1)
    limit 1;

  if v_variant_id is not null then
    update floating_variants
      set stock_qty = stock_qty + p_quantity,
          cost = coalesce(p_cost, cost),
          price = coalesce(p_price, price)
      where id = v_variant_id;
  else
    insert into floating_variants (
      owner_user_id, product_id, flavor, nicotine_mg, size, for_device, ohms, sku, cost, price, stock_qty
    ) values (
      auth.uid(), v_product_id, nullif(trim(coalesce(p_flavor, '')), ''), p_nicotine_mg,
      nullif(trim(coalesce(p_size, '')), ''), nullif(trim(coalesce(p_for_device, '')), ''), p_ohms,
      nullif(trim(coalesce(p_sku, '')), ''), coalesce(p_cost, 0), coalesce(p_price, 0), p_quantity
    )
    returning id into v_variant_id;
  end if;

  return v_variant_id;
end;
$$;
