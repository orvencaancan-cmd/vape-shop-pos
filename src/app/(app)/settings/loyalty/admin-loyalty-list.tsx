import { createClient } from "@/lib/supabase/server";
import { LoyaltyForm } from "./loyalty-form";
import type { ShopMembership } from "@/lib/auth/get-current-profile";

export async function AdminLoyaltyList({ ownedShops }: { ownedShops: ShopMembership[] }) {
  const supabase = await createClient();
  const shopIds = ownedShops.map((s) => s.shopId);
  const { data: shops } = await supabase
    .from("shops")
    .select("id, loyalty_earn_enabled, loyalty_redeem_enabled, loyalty_reward_percent")
    .in("id", shopIds);

  const shopById = new Map((shops ?? []).map((s) => [s.id, s]));

  return (
    <main className="animate-fade-in-up mx-auto max-w-2xl px-4 py-8">
      <h1 className="heading text-2xl">Loyalty</h1>
      <p className="mt-1 text-sm text-muted">
        Customers earn store credit based on what they spend, redeemable at any of your
        branches that accepts redemptions. Each branch sets its own participation and rate.
      </p>

      <div className="stagger mt-6 flex flex-col gap-3">
        {ownedShops.map((s) => {
          const shop = shopById.get(s.shopId);
          return (
            <div
              key={s.shopId}
              className="rounded-lg border border-hairline bg-canvas-soft p-4"
            >
              <p className="text-sm font-medium text-ink">{s.shopName}</p>
              <div className="mt-2">
                <LoyaltyForm
                  shopId={s.shopId}
                  earnEnabled={shop?.loyalty_earn_enabled ?? false}
                  redeemEnabled={shop?.loyalty_redeem_enabled ?? false}
                  rewardPercent={Number(shop?.loyalty_reward_percent ?? 0)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
