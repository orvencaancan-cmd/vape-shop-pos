import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { statusLabel, isTrialExpired } from "@/lib/billing-status";

export default async function AdminActivityPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.platformAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: shops }, { data: ownerProfiles }, allUsers, { data: lastActivity }] = await Promise.all([
    supabase
      .from("shops")
      .select(
        "id, name, subscription_status, trial_ends_at, current_period_end, suspended_at, created_at",
      )
      .eq("is_platform_shop", false)
      .order("created_at", { ascending: false }),
    // profiles RLS has no platform_admin bypass (only shops does), so
    // reading every shop's owner needs the admin client -- same pattern as
    // admin/[shopId]/page.tsx.
    admin.from("profiles").select("shop_id, user_id, created_at").eq("role", "owner").order("created_at"),
    listAllUsers(admin),
    supabase.rpc("get_last_activity_dates"),
  ]);

  // A shop can have more than one owner; take the earliest (the founding
  // owner), matching the same "first owner" convention used throughout the
  // RPCs (record_sale, transfer_staff, etc.) -- ownerProfiles is already
  // ordered by created_at, so the first match per shop_id wins.
  const firstOwnerByShopId = new Map<string, string>();
  for (const p of ownerProfiles ?? []) {
    if (!firstOwnerByShopId.has(p.shop_id)) firstOwnerByShopId.set(p.shop_id, p.user_id);
  }
  const lastSignInByUserId = new Map(allUsers.map((u) => [u.id, u.last_sign_in_at]));
  const lastActivityByShopId = new Map(
    ((lastActivity ?? []) as { shop_id: string; last_activity_at: string }[]).map((r) => [
      r.shop_id,
      r.last_activity_at,
    ]),
  );

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="heading text-2xl">Activity</h1>
        <Link href="/admin" className="text-xs text-primary underline underline-offset-2">
          Back to Platform admin
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Login and activity history for every signed-up shop, in one table.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-muted">
              <th className="py-1.5 pr-3">Shop</th>
              <th className="py-1.5 pr-3">Status</th>
              <th className="py-1.5 pr-3">Trial/subscription ends</th>
              <th className="py-1.5 pr-3">Signed up</th>
              <th className="py-1.5 pr-3">Last login</th>
              <th className="py-1.5">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {(shops ?? []).map((s) => {
              const ownerUserId = firstOwnerByShopId.get(s.id);
              const lastSignInAt = ownerUserId ? lastSignInByUserId.get(ownerUserId) : null;
              const lastActivityAt = lastActivityByShopId.get(s.id);
              const endDate =
                s.subscription_status === "trialing"
                  ? s.trial_ends_at
                  : s.subscription_status === "active"
                    ? s.current_period_end
                    : null;
              const signedUpDays = daysSince(s.created_at);
              const stalled = !lastActivityAt && signedUpDays > 7;
              return (
                <tr key={s.id} className="border-b border-hairline">
                  <td className="py-1.5 pr-3">
                    <Link
                      href={`/admin/${s.id}`}
                      className="text-primary underline underline-offset-2"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 text-body">
                    {statusLabel({
                      subscriptionStatus: s.subscription_status,
                      trialEndsAt: s.trial_ends_at,
                      currentPeriodEnd: s.current_period_end,
                    })}
                    {s.suspended_at && <span className="ml-1 text-xs text-error">(suspended)</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">
                    {endDate ? new Date(endDate).toLocaleDateString() : "—"}
                    {s.subscription_status === "trialing" &&
                      isTrialExpired({
                        subscriptionStatus: s.subscription_status,
                        trialEndsAt: s.trial_ends_at,
                        currentPeriodEnd: s.current_period_end,
                      }) && <span className="ml-1 text-xs text-error">(expired)</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">
                    {new Date(s.created_at).toLocaleDateString()} ({formatDaysAgo(signedUpDays)})
                  </td>
                  <td className="py-1.5 pr-3 text-muted">
                    {lastSignInAt
                      ? `${new Date(lastSignInAt).toLocaleDateString()} (${formatDaysAgo(daysSince(lastSignInAt))})`
                      : "Never"}
                  </td>
                  <td className={`py-1.5 ${stalled ? "text-warning" : "text-muted"}`}>
                    {lastActivityAt
                      ? `${new Date(lastActivityAt).toLocaleDateString()} (${formatDaysAgo(daysSince(lastActivityAt))})`
                      : "No activity yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function formatDaysAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}
