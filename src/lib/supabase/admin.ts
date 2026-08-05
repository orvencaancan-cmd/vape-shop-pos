import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Only use server-side (webhooks,
 * trusted admin actions), never expose this key to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// admin.auth.admin.listUsers() defaults to a 50-user page and silently
// truncates past it -- this is a platform-wide count (every login across
// every tenant shop), not per-shop, so it's easy to outgrow without
// noticing (a user beyond the first page just renders as "Unnamed" or an
// email lookup miss, not an error). Pages through every result instead.
export async function listAllUsers(admin: ReturnType<typeof createAdminClient>) {
  const perPage = 200;
  let page = 1;
  const users: User[] = [];
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
  }
  return users;
}
