"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function approvePaymentAction(requestId: string) {
  const profile = await getCurrentProfile();
  if (!profile?.platformAdmin) return;

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("manual_payment_requests")
    .select("id, shop_id, status")
    .eq("id", requestId)
    .single();
  if (!request || request.status !== "pending") return;

  const { data: shop } = await admin
    .from("shops")
    .select("current_period_end")
    .eq("id", request.shop_id)
    .single();
  if (!shop) return;

  // Paying early (before the current period is up) extends from that
  // date rather than from today, so nothing is lost by renewing ahead of
  // time; a lapsed or first-time payment starts fresh from now.
  const currentEnd = shop.current_period_end ? new Date(shop.current_period_end) : null;
  const base = currentEnd && currentEnd.getTime() > Date.now() ? currentEnd : new Date();
  const newPeriodEnd = new Date(base);
  newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

  await admin
    .from("manual_payment_requests")
    .update({ status: "approved", reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  await admin
    .from("shops")
    .update({
      subscription_status: "active",
      current_period_end: newPeriodEnd.toISOString(),
    })
    .eq("id", request.shop_id);

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath(`/admin/${request.shop_id}`);
}

export async function rejectPaymentAction(requestId: string) {
  const profile = await getCurrentProfile();
  if (!profile?.platformAdmin) return;

  const admin = createAdminClient();
  await admin
    .from("manual_payment_requests")
    .update({ status: "rejected", reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");

  revalidatePath("/admin/payments");
}
