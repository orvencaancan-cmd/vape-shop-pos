-- Fixes get_last_activity_dates() (0041): failed at call time with
-- "column reference 'shop_id' is ambiguous" -- the RETURNS TABLE clause
-- declares an OUT parameter named shop_id, and plpgsql matched every bare
-- `shop_id` inside the UNION ALL subqueries against that OUT parameter
-- instead of the actual table column, rather than raising an error until
-- the function actually ran (CREATE FUNCTION doesn't validate a plpgsql
-- body against the schema). Same root class of bug as
-- 0029_fix_register_loyalty_customer.sql's ambiguous-column fix, just a
-- different collision (OUT parameter vs. RETURNING alias there). Fixed by
-- qualifying every shop_id reference with its source table.
create or replace function get_last_activity_dates()
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
      select sales.shop_id, sales.created_at as activity_at from sales
      union all
      select stock_receipts.shop_id, stock_receipts.received_at as activity_at from stock_receipts
      union all
      select stock_audits.shop_id, stock_audits.started_at as activity_at from stock_audits
      union all
      select stock_corrections.shop_id, stock_corrections.created_at as activity_at from stock_corrections
      union all
      select expenses.shop_id, expenses.created_at as activity_at from expenses
      union all
      select products.shop_id, products.created_at as activity_at from products
      union all
      select variants.shop_id, variants.created_at as activity_at from variants
    ) a
    group by a.shop_id;
end;
$$;
