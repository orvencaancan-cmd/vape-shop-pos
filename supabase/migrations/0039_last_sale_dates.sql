-- Backs the Admin panel's "Last activity" column -- lets a platform admin
-- see at a glance which signed-up shops are actually recording sales
-- versus which have none yet, so a stalled signup doesn't hide behind a
-- healthy-looking trial/subscription status. One row per shop that has at
-- least one sale (shops with none simply won't appear in the result --
-- the caller treats "not present" as "no sales yet").
--
-- Platform-admin-only and SECURITY DEFINER: sales_select RLS
-- (is_member_of(shop_id), see 0015_multi_shop_ownership.sql) has no
-- platform_admin bypass, and a platform admin isn't a member of every
-- shop, so this needs to read across shops the same way
-- admin/[shopId]/page.tsx's owner-profile lookups do.
create function get_last_sale_dates()
returns table (shop_id uuid, last_sale_at timestamptz)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_platform_admin() then
    raise exception 'only a platform admin can view this';
  end if;

  return query
    select s.shop_id, max(s.created_at) as last_sale_at
    from sales s
    group by s.shop_id;
end;
$$;
