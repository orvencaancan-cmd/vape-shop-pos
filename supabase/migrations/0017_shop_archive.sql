-- Owner-initiated "archive a branch": hides it from daily use while
-- preserving all historical data. Distinct from suspended_at (a platform-
-- admin punitive pause) -- this is voluntary and owner-reversible.
alter table shops add column archived_at timestamptz;
