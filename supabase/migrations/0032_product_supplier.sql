-- Lets "Add E-juice" record a preferred supplier per flavor line, asked once
-- for the whole batch (before the per-nicotine-level cost/price/flavors
-- blocks) -- not tied to an actual stock receipt/quantity, just descriptive.
alter table products add column supplier_id uuid references suppliers (id) on delete set null;
