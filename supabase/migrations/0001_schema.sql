-- Core schema for the multi-tenant vape shop POS/inventory app.
-- Run this in the Supabase SQL Editor (or via `supabase db push`) before 0002/0003/0004.

create extension if not exists "pgcrypto";

create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  logo_url text,
  primary_color text
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  shop_id uuid not null references shops (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  platform_admin boolean not null default false,
  display_name text,
  created_at timestamptz not null default now()
);
create index profiles_shop_id_idx on profiles (shop_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  name text not null,
  category text not null check (category in ('ejuice', 'accessory')),
  description text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index products_shop_id_idx on products (shop_id);

create table variants (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  flavor text,
  nicotine_mg numeric,
  size text,
  sku text,
  cost numeric not null default 0,
  price numeric not null default 0,
  stock_qty integer not null default 0,
  low_stock_threshold integer not null default 5,
  created_at timestamptz not null default now()
);
create index variants_shop_id_idx on variants (shop_id);
create index variants_product_id_idx on variants (product_id);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  name text not null,
  contact_info text,
  created_at timestamptz not null default now()
);
create index suppliers_shop_id_idx on suppliers (shop_id);

create table stock_receipts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  variant_id uuid not null references variants (id) on delete cascade,
  supplier_id uuid references suppliers (id) on delete set null,
  quantity_added integer not null,
  unit_cost numeric,
  note text,
  received_by uuid references profiles (id) on delete set null,
  received_at timestamptz not null default now()
);
create index stock_receipts_shop_id_idx on stock_receipts (shop_id);
create index stock_receipts_variant_id_idx on stock_receipts (variant_id);

create table sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  total numeric not null default 0
);
create index sales_shop_id_idx on sales (shop_id);
create index sales_created_at_idx on sales (created_at);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  sale_id uuid not null references sales (id) on delete cascade,
  variant_id uuid not null references variants (id),
  quantity integer not null,
  unit_price numeric not null,
  unit_cost numeric not null default 0
);
create index sale_items_shop_id_idx on sale_items (shop_id);
create index sale_items_sale_id_idx on sale_items (sale_id);
