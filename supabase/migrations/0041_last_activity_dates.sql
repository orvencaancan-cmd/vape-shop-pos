-- Backs the Admin panel's new "Activity" tab -- a broader signal than
-- get_last_sale_dates (0039), which only looks at sales. This one answers
-- "has this shop done ANYTHING" by taking the most recent timestamp
-- across every activity-generating table: selling, receiving stock,
-- running an audit, correcting stock, logging an expense, or even just
-- adding their first product/variant (catalog setup is real activity too
-- -- see the Crow Brew Vape Shop case this was built for: zero sales, but
-- a real setup session on signup day).
--
-- Platform-admin-only and SECURITY DEFINER for the same reason as every
-- other cross-shop admin aggregate in this file's neighborhood
-- (get_last_sale_dates, get_feature_adoption): none of these tables' RLS
-- has a platform_admin bypass.
create function get_last_activity_dates()
returns table (shop_id uuid, last_activity_at timestamptz)
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
    select a.shop_id, max(a.activity_at) as last_activity_at
    from (
      select shop_id, created_at as activity_at from sales
      union all
      select shop_id, received_at as activity_at from stock_receipts
      union all
      select shop_id, started_at as activity_at from stock_audits
      union all
      select shop_id, created_at as activity_at from stock_corrections
      union all
      select shop_id, created_at as activity_at from expenses
      union all
      select shop_id, created_at as activity_at from products
      union all
      select shop_id, created_at as activity_at from variants
    ) a
    group by a.shop_id;
end;
$$;
