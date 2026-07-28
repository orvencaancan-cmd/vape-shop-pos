-- Owners can remove a *completed* audit from history (the existing
-- stock_audits_delete policy from 0020 only covers in-progress ones, via
-- "Discard audit"). This only removes the record -- it does not attempt to
-- reverse whatever stock adjustment the audit already applied.
create policy "stock_audits_delete_completed_owner" on stock_audits for delete
  using (is_owner(shop_id) and completed_at is not null);
