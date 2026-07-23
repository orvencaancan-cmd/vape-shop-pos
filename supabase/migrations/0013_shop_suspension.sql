-- Platform-admin-managed pause, distinct from subscription_status (which
-- reflects Stripe's billing state, not a manual admin action).
alter table shops add column suspended_at timestamptz;
