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
    // createClient() returns a shared singleton (createBrowserClient caches
    // it to avoid spinning up duplicate GoTrue instances), so every mount of
    // this hook -- across pages, or React 18 Strict Mode's dev-only double-
    // invoke of the same mount -- shares one underlying Realtime connection
    // and channel registry. Two things follow from that:
    //
    // 1. supabase.channel(topic) REUSES an existing channel object if one is
    //    already registered under that exact topic string (this is
    //    documented behavior of RealtimeClient.channel(), not a bug) --
    //    so a second mount using the same topic as a still-registered one
    //    doesn't get a fresh channel, it gets the same (already-subscribed)
    //    object back, and .on() on an already-subscribed channel throws
    //    "cannot add postgres_changes callbacks ... after subscribe()".
    // 2. removeChannel() is asynchronous -- it awaits channel.unsubscribe()
    //    (a round trip to the server) before actually deregistering the
    //    channel via teardown(). A previous mount's cleanup calling
    //    removeChannel() does NOT finish before the next mount's effect
    //    runs (React doesn't wait for cleanup to settle), so navigating
    //    quickly between two pages that both mount this hook for the same
    //    shopId reliably hits case 1 above: the old channel is still
    //    registered (and still reporting "joined") when the new mount asks
    //    for the same topic.
    //
    // Fix: give every mount its own private topic (random suffix) so there
    // is never a topic collision to race on, regardless of how fast
    // navigation happens or how slowly the previous mount's removeChannel()
    // resolves.
    const topic = `sales-changes-${shopId}-${Math.random().toString(36).slice(2)}`;

    // A second, independent race: if this component unmounts before
    // getSession() below resolves, `channel` is still null at cleanup time,
    // so cleanup has nothing to remove -- the orphaned .then() then fires
    // later and creates+subscribes a channel nothing will ever clean up.
    // The unique topic above stops that orphan from colliding with anyone
    // else's channel, but it'd still leak a forgotten subscription, so bail
    // out of the async chain entirely once unmounted.
    let cancelled = false;

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
      if (cancelled) return;
      supabase.realtime.setAuth(data.session?.access_token);
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sales", filter: `shop_id=eq.${shopId}` },
          () => router.refresh(),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [shopId, router]);
}
