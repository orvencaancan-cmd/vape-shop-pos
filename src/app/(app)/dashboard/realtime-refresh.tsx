"use client";

import { useRealtimeSalesRefresh } from "@/lib/supabase/use-realtime-sales-refresh";

// Renders nothing -- just keeps the Dashboard's server-rendered "Today"
// stats and Recent sales list live when a sale is rung up or voided from
// another session (e.g. a staff member at the register).
export function DashboardRealtimeRefresh({ shopId }: { shopId: string }) {
  useRealtimeSalesRefresh(shopId);
  return null;
}
