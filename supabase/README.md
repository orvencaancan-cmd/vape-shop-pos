# Database setup

Run these in the Supabase SQL Editor, in order, on a fresh project:

1. `migrations/0001_schema.sql` — tables
2. `migrations/0002_rls.sql` — Row Level Security policies (tenant isolation)
3. `migrations/0003_functions.sql` — signup/sale/restock RPCs + last-owner guardrail
4. `migrations/0004_storage.sql` — `shop-logos` storage bucket + policies

After that, sign up your own shop through the running app's `/signup` page, then run `bootstrap_platform_admin.sql` (with your email filled in) to give your account access to `/admin`.
