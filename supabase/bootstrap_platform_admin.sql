-- One-time step, run manually in the Supabase SQL Editor after you've
-- signed up your own shop through the app's normal /signup flow.
-- Replace the email before running.

update profiles
set platform_admin = true
where id = (select id from auth.users where email = 'you@example.com');
