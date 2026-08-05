"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./client";

// Subscribes to Realtime changes on this shop's own sales rows (new sales,
// voids) and triggers a router.refresh() when one comes in -- lets the
// Dashboard and Sell screen pick up another session's activity (e.g. a
// staff member ringing up a sale while the owner has the page open
// elsewhere) without a manual reload. router.refresh() re-runs the Server
// Component and passes fresh props down; consumers whose own local state is
// seeded from those props via useState still need to re-sync it themselves
// (see sell-screen.tsx) since a prop change alone doesn't reset state that's
// already mounted.
export function useRealtimeSalesRefresh(shopId: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Realtime's RLS check (sales_select: is_member_of(shop_id)) is
    // evaluated against whatever auth token is attached to the websocket
    // connection -- calling channel().subscribe() before that token is set
    // races the auth handshake, so the channel reports SUBSCRIBED but every
    // event silently gets filtered out as if the connection were anonymous.
    // setAuth() (and re-calling it on every token refresh, since sessions
    // now correctly refresh via middleware.ts instead of expiring) avoids
    // that race.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      supabase.realtime.setAuth(session?.access_token);
    });

    supabase.auth.getSession().then(({ data }) => {
      supabase.realtime.setAuth(data.session?.access_token);
      channel = supabase
        .channel(`sales-changes-${shopId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sales", filter: `shop_id=eq.${shopId}` },
          () => router.refresh(),
        )
        .subscribe();
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [shopId, router]);
}
