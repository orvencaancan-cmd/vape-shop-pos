import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { fetchTodayCashSession, computeCashInDrawer, fetchPendingTransfers } from "@/lib/cash-flow";
import { computePaymentBreakdown } from "@/lib/reports/compute";
import { formatCurrency } from "@/lib/currency";
import { Stat } from "@/components/ui/stat";
import { FloatingCashPanel } from "./floating-cash-panel";
import { BranchCashCard } from "./branch-cash-card";

export default async function CashFlowPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");
  if (!profile.inAdminOverview) redirect("/dashboard");

  const ownedShops = profile.shops.filter((s) => s.role === "owner");
  const activeShops = ownedShops.filter((s) => !s.archivedAt);

  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const { data: floatingMovementsRaw } = await supabase
    .from("floating_cash_movements")
    .select(
      "id, direction, amount, note, created_at, profiles(display_name), counterparty:counterparty_shop_id(name)",
    )
    .order("created_at", { ascending: false });

  const floatingMovements = (floatingMovementsRaw ?? []).map((m) => {
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
  const floatingBalance = floatingMovements.reduce(
    (sum, m) => sum + (m.direction === "in" ? m.amount : -m.amount),
    0,
  );

  const branchCards = await Promise.all(
    activeShops.map(async (s) => {
      const [{ session, movements }, { data: todaySales }] = await Promise.all([
        fetchTodayCashSession(supabase, s.shopId),
        supabase
          .from("sales")
          .select("total, payment_method")
          .eq("shop_id", s.shopId)
          .gte("created_at", todayStart.toISOString())
          .lt("created_at", todayEnd.toISOString())
          .is("voided_at", null),
      ]);
      const cashSalesToday = computePaymentBreakdown(todaySales ?? []).cash;
      const cashInDrawer = computeCashInDrawer(session, cashSalesToday, movements);
      // Whatever's currently known to be sitting in this branch's drawer --
      // the live total while open, the counted amount once closed, or
      // nothing tracked yet if the register hasn't been opened today.
      const drawerNow = session?.status === "closed" ? (session.closingCash ?? 0) : cashInDrawer;
      return {
        shopId: s.shopId,
        shopName: s.shopName,
        session,
        movements,
        cashSalesToday,
        cashInDrawer,
        drawerNow,
      };
    }),
  );

  const totalInDrawers = branchCards.reduce((sum, b) => sum + b.drawerNow, 0);
  const totalCashAvailable = floatingBalance + totalInDrawers;

  const pendingTransfers = await fetchPendingTransfers(supabase);
  const floatingIncoming = pendingTransfers.filter((t) => t.destinationType === "floating");
  const floatingOutgoing = pendingTransfers.filter((t) => t.sourceType === "floating");

  return (
    <main className="animate-fade-in-up mx-auto max-w-4xl px-4 py-8">
      <h1 className="heading text-2xl">Cash Flow</h1>
      <p className="mt-1 text-sm text-muted">
        Open or close any branch&apos;s register, log cash in/out, and manage your shared floating
        cash — all from one place.
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Stat label="Floating cash" value={formatCurrency(floatingBalance)} />
        <Stat label="In branch drawers" value={formatCurrency(totalInDrawers)} />
        <Stat label="Total cash available" value={formatCurrency(totalCashAvailable)} />
      </div>

      <div className="mt-6">
        <FloatingCashPanel
          balance={floatingBalance}
          movements={floatingMovements}
          branches={activeShops.map((s) => ({ shopId: s.shopId, shopName: s.shopName }))}
          incomingTransfers={floatingIncoming}
          outgoingTransfers={floatingOutgoing}
        />
      </div>

      <h2 className="mt-8 text-sm font-medium text-muted">Branches</h2>
      <div className="stagger mt-2 flex flex-col gap-4">
        {branchCards.map((b) => (
          <BranchCashCard
            key={b.shopId}
            shopId={b.shopId}
            shopName={b.shopName}
            session={b.session}
            movements={b.movements}
            cashSalesToday={b.cashSalesToday}
            cashInDrawer={b.cashInDrawer}
            otherBranches={activeShops
              .filter((s) => s.shopId !== b.shopId)
              .map((s) => ({ shopId: s.shopId, shopName: s.shopName }))}
            incomingTransfers={pendingTransfers.filter(
              (t) => t.destinationType === "branch" && t.destinationShopId === b.shopId,
            )}
            outgoingTransfers={pendingTransfers.filter(
              (t) => t.sourceType === "branch" && t.sourceShopId === b.shopId,
            )}
          />
        ))}
      </div>
    </main>
  );
}
