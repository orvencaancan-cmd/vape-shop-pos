-- The built-in "Other" catch-all category is removed from the app (see
-- src/lib/inventory/product-categories.ts) now that owners can make their
-- own catch-all via a self-service custom category. Existing products
-- already stored as category = 'Other' are untouched -- they keep
-- displaying and filtering fine via the same raw-string fallback that
-- already covers any archived or otherwise-unlisted category.
--
-- The only schema-level change needed is dropping "other" from the
-- reserved-name list create_custom_category rejects, since an owner can
-- now reasonably name their own category "Other" if they want to.
create or replace function create_custom_category(
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
    'ejuice', 'e-juice', 'cartridge', 'flavor pod', 'device', 'pod device', 'wire', 'cotton'
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
