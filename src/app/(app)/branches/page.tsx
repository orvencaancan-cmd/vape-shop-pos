import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { AddShopForm } from "./add-shop-form";
import { BranchRow } from "./branch-row";
import { FloatingCashPanel } from "./floating-cash-panel";

export default async function BranchesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (profile.role !== "owner") redirect("/inventory");

  const ownedShops = profile.shops.filter((s) => s.role === "owner");

  // A pool across a single branch isn't meaningful -- only fetched/shown
  // once there's more than one branch to share it across. RLS already
  // scopes floating_cash_movements to owner_user_id = auth.uid(), so no
  // explicit filter is needed here.
  let floatingBalance = 0;
  let floatingMovements: {
    id: string;
    direction: "in" | "out";
    amount: number;
    note: string | null;
    createdAt: string;
    createdByName: string | null;
    counterpartyName: string | null;
  }[] = [];
  if (ownedShops.length > 1) {
    const supabase = await createClient();
    const { data: floatingMovementsRaw } = await supabase
      .from("floating_cash_movements")
      .select(
        "id, direction, amount, note, created_at, profiles(display_name), counterparty:counterparty_shop_id(name)",
      )
      .order("created_at", { ascending: false });

    floatingMovements = (floatingMovementsRaw ?? []).map((m) => {
      const creator = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const counterparty = Array.isArray(m.counterparty) ? m.counterparty[0] : m.counterparty;
      return {
        id: m.id as string,
        direction: m.direction as "in" | "out",
        amount: Number(m.amount),
        note: m.note as string | null,
        createdAt: m.created_at as string,
        createdByName: (creator?.display_name as string | null) ?? null,
        counterpartyName: (counterparty?.name as string | null) ?? null,
      };
    });
    floatingBalance = floatingMovements.reduce(
      (sum, m) => sum + (m.direction === "in" ? m.amount : -m.amount),
      0,
    );
  }

  if (ownedShops.length <= 1) {
    return (
      <main className="animate-fade-in-up mx-auto max-w-md px-4 py-8">
        <h1 className="heading text-2xl">Branches</h1>
        <p className="mt-1 text-sm text-muted">Every shop you own, and a way to add another.</p>

        <ul className="mt-6 flex flex-col gap-2">
          {ownedShops.map((s) => (
            <li
              key={s.shopId}
              className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2 text-sm"
            >
              <span className="text-ink">{s.shopName}</span>
              <span className="text-xs text-muted">Active</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-muted">Add another shop</h2>
          <p className="mt-1 text-xs text-muted">
            Each shop gets its own inventory and staff. Billing setup is coming soon.
          </p>
          <AddShopForm />
        </div>
      </main>
    );
  }

  const activeShops = ownedShops.filter((s) => !s.archivedAt);
  const archivedShops = ownedShops.filter((s) => s.archivedAt);

  return (
    <main className="animate-fade-in-up mx-auto max-w-md px-4 py-8">
      <h1 className="heading text-2xl">Branches</h1>
      <p className="mt-1 text-sm text-muted">
        Add, archive, or step into any of your {activeShops.length} branches.
      </p>

      <div className="mt-6">
        <FloatingCashPanel
          balance={floatingBalance}
          movements={floatingMovements}
          branches={activeShops.map((s) => ({ shopId: s.shopId, shopName: s.shopName }))}
        />
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Active branches</h2>
      <div className="mt-2 flex flex-col gap-2">
        {activeShops.map((s) => (
          <BranchRow key={s.shopId} shopId={s.shopId} shopName={s.shopName} archived={false} />
        ))}
      </div>

      {archivedShops.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-medium text-muted">Archived branches</h2>
          <p className="mt-1 text-xs text-muted">
            Hidden from daily use, but all their history is kept.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {archivedShops.map((s) => (
              <BranchRow key={s.shopId} shopId={s.shopId} shopName={s.shopName} archived={true} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-medium text-muted">Add another branch</h2>
      <p className="mt-1 text-xs text-muted">
        Each branch gets its own inventory and staff. Billing setup is coming soon.
      </p>
      <AddShopForm />
    </main>
  );
}
