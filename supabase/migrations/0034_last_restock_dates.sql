-- Backs the Inventory "Last restocked" display. A shop's stock_receipts
-- history only grows over time, so rather than fetching every receipt row
-- to the client and reducing it in JS, this does the MAX(received_at)
-- grouping in the database and returns one row per variant. Not SECURITY
-- DEFINER -- the existing stock_receipts_select RLS policy (is_member_of)
-- already scopes rows to the caller correctly, this just adds the
-- shop_id filter and grouping on top of that.
create or replace function get_last_restock_dates(p_shop_id uuid)
returns table (variant_id uuid, last_restocked_at timestamptz)
language sql
stable
set search_path = public
as $$
  select variant_id, max(received_at) as last_restocked_at
  from stock_receipts
  where shop_id = p_shop_id
  group by variant_id;
$$;
