-- RPCs: signup, atomic sale recording (with stock deduction), and
-- restock logging. All SECURITY DEFINER so they can do their own
-- authorization/ownership checks and multi-table writes atomically,
-- rather than relying on several separately-RLS-checked statements.

-- Called right after supabase.auth.signUp() during shop signup, before
-- Stripe Checkout. Fails if this auth user already has a profile.
create or replace function create_shop(shop_name text, owner_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'this account is already linked to a shop';
  end if;

  insert into shops (name) values (shop_name) returning id into v_shop_id;

  insert into profiles (id, shop_id, role, display_name)
  values (auth.uid(), v_shop_id, 'owner', owner_display_name);

  return v_shop_id;
end;
$$;

-- items: jsonb array like [{"variant_id": "...", "quantity": 2}, ...]
create or replace function record_sale(items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := current_shop_id();
  v_sale_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_price numeric;
  v_cost numeric;
  v_stock integer;
  v_total numeric := 0;
begin
  if v_shop_id is null then
    raise exception 'not authenticated as a shop member';
  end if;
  if jsonb_array_length(items) = 0 then
    raise exception 'cart is empty';
  end if;

  insert into sales (shop_id, created_by) values (v_shop_id, auth.uid())
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
      where id = v_variant_id and shop_id = v_shop_id
      for update;

    if not found then
      raise exception 'variant % does not belong to this shop', v_variant_id;
    end if;
    if v_stock < v_quantity then
      raise exception 'insufficient stock for variant %', v_variant_id;
    end if;

    insert into sale_items (shop_id, sale_id, variant_id, quantity, unit_price, unit_cost)
      values (v_shop_id, v_sale_id, v_variant_id, v_quantity, v_price, v_cost);

    update variants set stock_qty = stock_qty - v_quantity where id = v_variant_id;

    v_total := v_total + (v_price * v_quantity);
  end loop;

  update sales set total = v_total where id = v_sale_id;

  return v_sale_id;
end;
$$;

create or replace function receive_stock(
  p_variant_id uuid,
  p_quantity integer,
  p_supplier_id uuid default null,
  p_unit_cost numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := current_shop_id();
  v_receipt_id uuid;
begin
  if v_shop_id is null then
    raise exception 'not authenticated as a shop member';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;
  if not exists (select 1 from variants where id = p_variant_id and shop_id = v_shop_id) then
    raise exception 'variant does not belong to this shop';
  end if;
  if p_supplier_id is not null
     and not exists (select 1 from suppliers where id = p_supplier_id and shop_id = v_shop_id) then
    raise exception 'supplier does not belong to this shop';
  end if;

  insert into stock_receipts (shop_id, variant_id, supplier_id, quantity_added, unit_cost, note, received_by)
    values (v_shop_id, p_variant_id, p_supplier_id, p_quantity, p_unit_cost, p_note, auth.uid())
    returning id into v_receipt_id;

  update variants
    set stock_qty = stock_qty + p_quantity,
        cost = coalesce(p_unit_cost, cost)
    where id = p_variant_id;

  return v_receipt_id;
end;
$$;

-- Guardrail: a shop must always keep at least one owner. The one
-- exception is when the whole shop is being torn down (`DELETE FROM
-- shops` cascading into this profile's deletion) — in that case the
-- `shops` row is already gone by the time this fires (Postgres applies
-- cascaded deletes within the same command, so an earlier delete in the
-- same statement is visible to a later one), so there's no shop left to
-- need an owner.
-- TG_OP/NEW aren't available in a trigger's WHEN clause (and NEW doesn't
-- exist at all on DELETE), so the "does this change actually remove an
-- owner" check has to live in the function body instead.
create or replace function prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining_owners integer;
begin
  if old.role <> 'owner' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;

  if tg_op = 'DELETE' and not exists (select 1 from shops where id = old.shop_id) then
    return old;
  end if;

  select count(*) into v_remaining_owners
    from profiles
    where shop_id = old.shop_id and role = 'owner' and id <> old.id;

  if v_remaining_owners = 0 then
    raise exception 'a shop must have at least one owner';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_last_owner
  before update of role or delete on profiles
  for each row
  execute function prevent_last_owner_removal();
