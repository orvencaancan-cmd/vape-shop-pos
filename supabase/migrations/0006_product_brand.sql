-- Products need a distinct "brand" (manufacturer/line) separate from the
-- product's own name, so shops can filter/search by it on the inventory
-- list — e.g. brand "Naked 100" with product name "Lava Flow".
alter table products add column brand text;
create index products_brand_idx on products (brand);
