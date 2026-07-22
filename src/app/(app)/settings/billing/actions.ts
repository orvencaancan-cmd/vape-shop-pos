"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export async function openBillingPortalAction() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") redirect("/settings/billing");

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("stripe_customer_id")
    .eq("id", profile.shopId)
    .single();
  if (!shop?.stripe_customer_id) redirect("/settings/billing");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: shop.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  redirect(session.url);
}
