import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { LoyaltyForm } from "./loyalty-form";
import { AdminLoyaltyList } from "./admin-loyalty-list";

export default async function LoyaltyPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");

  if (profile.inAdminOverview) {
    const activeOwnedShops = profile.shops.filter((s) => s.role === "owner" && !s.archivedAt);
    return <AdminLoyaltyList ownedShops={activeOwnedShops} />;
  }
  if (profile.role !== "owner") redirect("/inventory");

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("loyalty_earn_enabled, loyalty_redeem_enabled, loyalty_reward_percent")
    .eq("id", profile.shopId)
    .single();

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">Promos</h1>
      <p className="mt-1 text-sm text-muted">
        Loyalty: customers earn store credit here based on what they spend, redeemable on a
        future purchase at any of your branches that accepts redemptions.
      </p>

      <div className="mt-6 rounded-lg border border-hairline bg-canvas-soft p-4">
        <LoyaltyForm
          shopId={profile.shopId}
          earnEnabled={shop?.loyalty_earn_enabled ?? false}
          redeemEnabled={shop?.loyalty_redeem_enabled ?? false}
          rewardPercent={Number(shop?.loyalty_reward_percent ?? 0)}
        />
      </div>
    </main>
  );
}
