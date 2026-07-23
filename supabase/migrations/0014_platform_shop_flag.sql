-- Marks the placeholder shop that hosts the dedicated platform-admin login,
-- so the app can tell it apart from a real subscriber shop and show a
-- stripped-down nav (Admin + Reports only) instead of business tabs.
alter table shops add column is_platform_shop boolean not null default false;
