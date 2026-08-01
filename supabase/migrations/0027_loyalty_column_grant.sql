-- 0022 revoked table-wide update on shops and re-granted only specific
-- columns to authenticated (archived_at, primary_color, logo_url) -- the
-- new loyalty columns from 0026 need the same treatment, or the owner's
-- Loyalty settings save fails with "permission denied for table shops".
grant update (loyalty_earn_enabled, loyalty_redeem_enabled, loyalty_reward_percent) on shops to authenticated;
