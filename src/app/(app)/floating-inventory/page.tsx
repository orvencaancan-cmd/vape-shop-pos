import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { fetchFloatingCatalog, fetchPendingInventoryTransfers, fetchUnresolvedShortfalls } from "@/lib/inventory-transfer";
import { IncomingInventoryChecklist, OutgoingInventoryList } from "@/components/inventory-transfer-checklist";
import { FloatingInventoryPanel } from "./floating-inventory-panel";
import { BranchInventoryCard } from "./branch-inventory-card";
import { BranchTransferPanel } from "./branch-transfer-panel";
import { ShortfallList } from "./shortfall-list";

export default async function FloatingInventoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (!profile.inAdminOverview) redirect("/dashboard");

  const supabase = await createClient();
  const [catalog, pendingTransfers, shortfalls] = await Promise.all([
    fetchFloatingCatalog(supabase),
    fetchPendingInventoryTransfers(supabase),
    fetchUnresolvedShortfalls(supabase),
  ]);

  const ownedShops = profile.shops.filter((s) => s.role === "owner");
  const activeShops = ownedShops.filter((s) => !s.archivedAt);

  const floatingIncoming = pendingTransfers.filter((t) => t.destinationType === "floating");
  const floatingOutgoing = pendingTransfers.filter((t) => t.sourceType === "floating");

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <h1 className="heading text-2xl">Floating Inventory</h1>
      <p className="mt-1 text-sm text-muted">
        Stock you hold outside any branch, ready to send wherever it&apos;s needed.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <ShortfallList shortfalls={shortfalls} />
        <FloatingInventoryPanel
          catalog={catalog}
          branches={activeShops.map((s) => ({ shopId: s.shopId, shopName: s.shopName }))}
        />
        <IncomingInventoryChecklist transfers={floatingIncoming} />
        <OutgoingInventoryList transfers={floatingOutgoing} canCancel />
        {activeShops.length >= 2 && (
          <BranchTransferPanel branches={activeShops.map((s) => ({ shopId: s.shopId, shopName: s.shopName }))} />
        )}
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Branches</h2>
      <div className="stagger mt-2 flex flex-col gap-4">
        {activeShops.map((s) => (
          <BranchInventoryCard
            key={s.shopId}
            shopName={s.shopName}
            incoming={pendingTransfers.filter(
              (t) => t.destinationType === "branch" && t.destinationShopId === s.shopId,
            )}
            outgoing={pendingTransfers.filter(
              (t) => t.sourceType === "branch" && t.sourceShopId === s.shopId,
            )}
          />
        ))}
        {activeShops.every(
          (s) =>
            pendingTransfers.filter(
              (t) =>
                (t.destinationType === "branch" && t.destinationShopId === s.shopId) ||
                (t.sourceType === "branch" && t.sourceShopId === s.shopId),
            ).length === 0,
        ) && <p className="text-sm text-muted">No pending transfers with any branch right now.</p>}
      </div>
    </main>
  );
}
