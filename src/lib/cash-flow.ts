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
