"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function openBillingPortalAction() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("shop_id, role").single();
  if (!profile || profile.role !== "owner") redirect("/settings/billing");

  const { data: shop } = await supabase
    .from("shops")
    .select("stripe_customer_id")
    .eq("id", profile.shop_id)
    .single();
  if (!shop?.stripe_customer_id) redirect("/settings/billing");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: shop.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  redirect(session.url);
}
