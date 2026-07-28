-- Two-tier pricing (₱1,000 for an owner's first/"primary" shop, ₱500 for
-- every shop after that/"additional") plus a card-less trial: every shop
-- now gets a real trial_ends_at at creation, no Stripe involvement until
-- the owner explicitly subscribes. billing_tier is fixed at creation time
-- by creation order and never shifts if an earlier shop is later archived.

alter table shops add column billing_tier text not null default 'primary'
  check (billing_tier in ('primary', 'additional'));

create or replace function create_shop(shop_name text, owner_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_tier text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select case
    when exists (select 1 from profiles where user_id = auth.uid() and role = 'owner')
    then 'additional'
    else 'primary'
  end into v_tier;

  insert into shops (name, billing_tier, trial_ends_at)
  values (shop_name, v_tier, now() + interval '14 days')
  returning id into v_shop_id;

  insert into profiles (user_id, shop_id, role, display_name)
  values (auth.uid(), v_shop_id, 'owner', owner_display_name);

  return v_shop_id;
end;
$$;

-- subscription_status/trial_ends_at/billing_tier are the entire paywall now,
-- but the existing shops_update_owner RLS policy only checks row ownership
-- (using (is_owner(id)), no with check), so any shop owner could otherwise
-- grant themselves "active" directly via the Supabase client. Every
-- legitimate writer of these columns already goes through this
-- security-definer RPC or the service-role admin client (Stripe webhook,
-- the platform-admin trial-date editor) -- never the regular client -- and
-- the regular client only ever updates archived_at/primary_color/logo_url
-- on shops (confirmed across the whole codebase). Note a column-level
-- revoke alone would NOT work here: Postgres's default per-table grant
-- (from Supabase's initial setup) already covers every column, and a
-- column-specific REVOKE can't carve an exception out of a table-wide
-- GRANT -- the table-wide grant has to come off first, then the safe
-- columns re-granted individually.
revoke update on shops from authenticated, anon;
grant update (archived_at, primary_color, logo_url) on shops to authenticated;
