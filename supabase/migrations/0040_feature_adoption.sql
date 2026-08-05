-- Backs the Admin panel's "Feature adoption" section -- answers "which
-- features do subscribers actually use" by counting, per feature, how
-- many distinct shops have used it at least once. Counts rather than raw
-- rows (same reasoning as get_last_sale_dates/get_last_restock_dates) so
-- this stays a handful of cheap aggregate queries regardless of how much
-- sales/expense/audit history accumulates.
--
-- Platform-admin-only and SECURITY DEFINER for the same reason as
-- get_last_sale_dates: these tables' RLS (is_member_of(shop_id)) has no
-- platform_admin bypass, and a platform admin isn't a member of every shop.
create function get_feature_adoption()
returns table (feature text, shop_count integer)
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
    select 'Discounts'::text, count(distinct shop_id)::integer from sales where discount_amount > 0
    union all
    select 'Sale promo', count(distinct shop_id)::integer from sales where sale_discount_amount > 0
    union all
    select 'Loyalty program', count(distinct shop_id)::integer from sales where loyalty_customer_id is not null
    union all
    select 'Stock audits', count(distinct shop_id)::integer from stock_audits
    union all
    select 'Stock corrections', count(distinct shop_id)::integer from stock_corrections
    union all
    select 'Expense tracking', count(distinct shop_id)::integer from expenses;
end;
$$;
