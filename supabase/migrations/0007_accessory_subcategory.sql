-- Accessories can have a subcategory (e.g. "Cartridge", "Coil", "Battery")
-- and cartridge-style variants need to record which device they fit.
alter table products add column subcategory text;
alter table variants add column for_device text;
create index products_subcategory_idx on products (subcategory);
