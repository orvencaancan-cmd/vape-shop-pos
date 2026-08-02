-- One-time data cleanup for the Vaportal shop: before the Add E-juice
-- redesign (which asks for all nicotine levels in one submission), each
-- nicotine level had been added as its own separate "Add flavors" batch,
-- so a single flavor (e.g. "Almonds") ended up as several separate product
-- rows -- one per nicotine level -- instead of one product with several
-- variants. This merges each such group into one canonical product
-- (the earliest-created row) and reassigns its siblings' variants onto it,
-- then removes the now-empty duplicate product rows. Every variant's own
-- stock/price/cost is untouched -- only which product it belongs to
-- changes. Reviewed against a full before/after preview before running.

with target_shop as (
  select id as shop_id from shops where name = 'Vaportal'
),
groups as (
  select
    p.id,
    p.shop_id,
    first_value(p.id) over (
      partition by p.shop_id, p.brand, p.name
      order by p.created_at asc, p.id asc
    ) as canonical_id
  from products p
  join target_shop ts on ts.shop_id = p.shop_id
  where p.category = 'ejuice' and p.archived = false
),
duplicates as (
  select id, canonical_id from groups where id <> canonical_id
)
update variants v
set product_id = d.canonical_id
from duplicates d
where v.product_id = d.id;

with target_shop as (
  select id as shop_id from shops where name = 'Vaportal'
),
groups as (
  select
    p.id,
    p.shop_id,
    first_value(p.id) over (
      partition by p.shop_id, p.brand, p.name
      order by p.created_at asc, p.id asc
    ) as canonical_id
  from products p
  join target_shop ts on ts.shop_id = p.shop_id
  where p.category = 'ejuice' and p.archived = false
)
delete from products p
using (select id from groups where id <> canonical_id) d
where p.id = d.id;
