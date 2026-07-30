-- Discounts on sales + a new miscellaneous-expenses ledger.

alter table sales add column discount_amount numeric not null default 0 check (discount_amount >= 0);
alter table sales add column discount_reason text;

drop function if exists record_sale(uuid, jsonb, text);

create function record_sale(p_shop_id uuid, items jsonb, p_payment_method text default 'cash',
                             p_discount_amount numeric default 0, p_discount_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_price numeric;
  v_cost numeric;
  v_stock integer;
  v_total numeric := 0;
  v_profile_id uuid;
begin
  if not is_member_of(p_shop_id) then
    raise exception 'not authenticated as a shop member';
  end if;
  if jsonb_array_length(items) = 0 then
    raise exception 'cart is empty';
  end if;
  if p_payment_method not in ('cash', 'gcash') then
    raise exception 'invalid payment method';
  end if;
  if p_discount_amount < 0 then
    raise exception 'discount cannot be negative';
  end if;

  select id into v_profile_id from profiles where user_id = auth.uid() and shop_id = p_shop_id;

  insert into sales (shop_id, created_by, payment_method) values (p_shop_id, v_profile_id, p_payment_method)
    returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(items)
  loop
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid quantity for variant %', v_variant_id;
    end if;

    select price, cost, stock_qty into v_price, v_cost, v_stock
      from variants
      where id = v_variant_id and shop_id = p_shop_id
      for update;

    if not found then
      raise exception 'variant % does not belong to this shop', v_variant_id;
    end if;
    if v_stock < v_quantity then
      raise exception 'insufficient stock for variant %', v_variant_id;
    end if;

    insert into sale_items (shop_id, sale_id, variant_id, quantity, unit_price, unit_cost)
      values (p_shop_id, v_sale_id, v_variant_id, v_quantity, v_price, v_cost);

    update variants set stock_qty = stock_qty - v_quantity where id = v_variant_id;

    v_total := v_total + (v_price * v_quantity);
  end loop;

  if p_discount_amount > v_total then
    raise exception 'discount exceeds sale subtotal';
  end if;

  update sales set
    total = v_total - p_discount_amount,
    discount_amount = p_discount_amount,
    discount_reason = nullif(trim(p_discount_reason), '')
    where id = v_sale_id;

  return v_sale_id;
end;
$$;

create table expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops (id) on delete cascade,
  amount numeric not null check (amount > 0),
  category text not null,
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index expenses_shop_id_idx on expenses (shop_id);
create index expenses_created_at_idx on expenses (created_at);

alter table expenses enable row level security;

create policy "expenses_select" on expenses for select
  using (is_member_of(shop_id));
create policy "expenses_insert" on expenses for insert
  with check (is_member_of(shop_id));
create policy "expenses_delete_owner" on expenses for delete
  using (is_member_of(shop_id) and is_owner(shop_id));
