-- Lets clients subscribe to live changes on the sales table (new sales,
-- voids) via Supabase Realtime, instead of needing a manual page reload to
-- see another session's activity (e.g. an owner's Dashboard/Sell screen
-- picking up a sale a staff member just rang up elsewhere). Realtime
-- respects this table's existing RLS (sales_select: is_member_of(shop_id)),
-- so a subscribed client only ever receives events for shops it belongs to
-- -- no additional policy needed here.
alter publication supabase_realtime add table sales;
