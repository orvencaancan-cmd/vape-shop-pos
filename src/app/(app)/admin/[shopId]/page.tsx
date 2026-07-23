// Account-level only: never query products/variants/sales/sale_items/stock_receipts/suppliers here.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ShopActions } from "./shop-actions";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment past due",
  canceled: "Canceled",
};

export default async function AdminShopPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.platformAdmin) redirect("/dashboard");

  const { shopId } = await params;

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select(
      "id, name, subscription_status, trial_ends_at, current_period_end, suspended_at, created_at",
    )
    .eq("id", shopId)
    .maybeSingle();
  if (!shop) notFound();

  // profiles RLS has no platform_admin bypass (only shops does), so owner
  // lookups for shops other than your own need the admin client too.
  const admin = createAdminClient();
  const { data: ownerProfiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("shop_id", shopId)
    .eq("role", "owner");

  // profiles doesn't store email; look it up via the admin API for display.
  const { data: userList } = await admin.auth.admin.listUsers();
  const emailById = new Map(userList?.users.map((u) => [u.id, u.email ?? ""]));

  const suspended = shop.suspended_at != null;

  return (
    <main className="animate-fade-in-up mx-auto max-w-xl px-4 py-8">
      <Link href="/admin" className="text-xs text-muted underline underline-offset-2 hover:text-ink">
        ← All shops
      </Link>
      <h1 className="heading mt-2 text-2xl">{shop.name}</h1>

      <Card padding="sm" className="mt-4">
        <p className="text-sm text-muted">Subscription status</p>
        <p className="text-lg font-semibold text-ink">
          {STATUS_LABEL[shop.subscription_status] ?? shop.subscription_status}
          {suspended && <span className="ml-2 text-sm font-normal text-error">(suspended)</span>}
        </p>
        {shop.subscription_status === "trialing" && shop.trial_ends_at && (
          <p className="mt-1 text-xs text-muted">
            Free trial ends {new Date(shop.trial_ends_at).toLocaleDateString()}
          </p>
        )}
        {(shop.subscription_status === "active" || shop.subscription_status === "past_due") &&
          shop.current_period_end && (
            <p className="mt-1 text-xs text-muted">
              Renews {new Date(shop.current_period_end).toLocaleDateString()}
            </p>
          )}
        <p className="mt-1 text-xs text-muted">
          Signed up {new Date(shop.created_at).toLocaleDateString()}
        </p>
      </Card>

      <Card padding="sm" className="mt-4">
        <p className="text-sm text-muted">Owner{(ownerProfiles?.length ?? 0) > 1 ? "s" : ""}</p>
        {(ownerProfiles ?? []).length === 0 ? (
          <p className="mt-1 text-sm text-ink">No owner found.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {(ownerProfiles ?? []).map((o) => (
              <li key={o.id} className="text-sm text-ink">
                {o.display_name || emailById.get(o.id) || "Unnamed"}{" "}
                <span className="text-xs text-muted">{emailById.get(o.id) ?? "unknown"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="sm" className="mt-4">
        <ShopActions
          shopId={shop.id}
          shopName={shop.name}
          suspended={suspended}
          trialEndsAt={shop.trial_ends_at ? shop.trial_ends_at.slice(0, 10) : null}
        />
      </Card>
    </main>
  );
}
