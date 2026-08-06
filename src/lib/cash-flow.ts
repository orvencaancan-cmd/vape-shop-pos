import type { createClient } from "@/lib/supabase/server";
import type { CashMovementRow } from "@/lib/reports/compute";

export type TodayCashSession = {
  id: string;
  openingCash: number;
  openedAt: string;
  closingCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  closedAt: string | null;
  status: "open" | "closed";
} | null;

// UTC calendar-day boundary, matching the convention used everywhere else
// "today" is derived in this app (Reports, Dashboard, the Sell screen).
function todayDateStr(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * Today's cash_sessions row for a shop (or null if the register hasn't been
 * opened today) plus its cash_movements, if the session is still open --
 * movements only matter while the drawer is actively being worked, and a
 * closed session's numbers are already frozen in the session row itself.
 */
export async function fetchTodayCashSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
): Promise<{ session: TodayCashSession; movements: CashMovementRow[] }> {
  const { data: sessionRow } = await supabase
    .from("cash_sessions")
    .select("id, opening_cash, opened_at, closing_cash, expected_cash, variance, closed_at, status")
    .eq("shop_id", shopId)
    .eq("business_date", todayDateStr())
    .maybeSingle();

  if (!sessionRow) return { session: null, movements: [] };

  const session: TodayCashSession = {
    id: sessionRow.id,
    openingCash: Number(sessionRow.opening_cash),
    openedAt: sessionRow.opened_at,
    closingCash: sessionRow.closing_cash != null ? Number(sessionRow.closing_cash) : null,
    expectedCash: sessionRow.expected_cash != null ? Number(sessionRow.expected_cash) : null,
    variance: sessionRow.variance != null ? Number(sessionRow.variance) : null,
    closedAt: sessionRow.closed_at,
    status: sessionRow.status,
  };

  if (session.status !== "open") return { session, movements: [] };

  const { data: movementRows } = await supabase
    .from("cash_movements")
    .select(
      "id, direction, movement_type, amount, note, created_at, profiles(display_name), counterparty:counterparty_shop_id(name)",
    )
    .eq("cash_session_id", session.id)
    .order("created_at", { ascending: false });

  const movements: CashMovementRow[] = (movementRows ?? []).map((m) => {
    const creator = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const counterparty = Array.isArray(m.counterparty) ? m.counterparty[0] : m.counterparty;
    return {
      id: m.id,
      createdAt: m.created_at,
      direction: m.direction,
      movementType: m.movement_type,
      amount: Number(m.amount),
      note: m.note,
      createdByName: (creator?.display_name as string | null) ?? null,
      counterpartyName: (counterparty?.name as string | null) ?? null,
    };
  });

  return { session, movements };
}

export type PendingTransfer = {
  id: string;
  sourceType: "branch" | "floating";
  sourceShopId: string | null;
  sourceShopName: string | null;
  destinationType: "branch" | "floating";
  destinationShopId: string | null;
  destinationShopName: string | null;
  amount: number;
  note: string | null;
  createdAt: string;
  initiatedByName: string | null;
};

// RLS already limits this to transfers touching a shop the caller belongs
// to (or that they personally initiated) -- see cash_transfers_select in
// 0044_cash_transfers.sql -- so a single unfiltered query is safe; callers
// slice it into "incoming to X" / "outgoing from X" themselves.
export async function fetchPendingTransfers(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PendingTransfer[]> {
  const { data } = await supabase
    .from("cash_transfers")
    .select(
      "id, source_type, source_shop_id, destination_type, destination_shop_id, amount, note, created_at, source_shop:source_shop_id(name), destination_shop:destination_shop_id(name), initiator:initiated_by(display_name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (data ?? []).map((t) => {
    const sourceShop = Array.isArray(t.source_shop) ? t.source_shop[0] : t.source_shop;
    const destinationShop = Array.isArray(t.destination_shop) ? t.destination_shop[0] : t.destination_shop;
    const initiator = Array.isArray(t.initiator) ? t.initiator[0] : t.initiator;
    return {
      id: t.id as string,
      sourceType: t.source_type as "branch" | "floating",
      sourceShopId: t.source_shop_id as string | null,
      sourceShopName: (sourceShop?.name as string | null) ?? null,
      destinationType: t.destination_type as "branch" | "floating",
      destinationShopId: t.destination_shop_id as string | null,
      destinationShopName: (destinationShop?.name as string | null) ?? null,
      amount: Number(t.amount),
      note: t.note as string | null,
      createdAt: t.created_at as string,
      initiatedByName: (initiator?.display_name as string | null) ?? null,
    };
  });
}

// Same formula close_cash_session computes server-side -- this is a
// convenience for live display only, never written anywhere.
export function computeCashInDrawer(
  session: TodayCashSession,
  cashSalesToday: number,
  movements: { direction: "in" | "out"; amount: number }[],
): number {
  const cashIn = movements.filter((m) => m.direction === "in").reduce((sum, m) => sum + m.amount, 0);
  const cashOut = movements.filter((m) => m.direction === "out").reduce((sum, m) => sum + m.amount, 0);
  return (session?.openingCash ?? 0) + cashSalesToday + cashIn - cashOut;
}
