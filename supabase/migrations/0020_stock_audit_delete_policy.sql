-- Missing from 0019: "Discard audit" deletes a stock_audits row, but there
-- was no delete policy, so RLS silently blocked it (0 rows affected, no error).
create policy "stock_audits_delete" on stock_audits for delete
  using (is_member_of(shop_id) and completed_at is null);
