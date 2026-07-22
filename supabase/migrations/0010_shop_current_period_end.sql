-- Renewal/period-end date for the Billing page, distinct from trial_ends_at
-- (which only applies during a trial). Populated by the Stripe webhook.
alter table shops add column current_period_end timestamptz;
