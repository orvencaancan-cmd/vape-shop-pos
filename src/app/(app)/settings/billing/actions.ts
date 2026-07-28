"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

/**
 * The only place Stripe/card entry ever enters the picture -- the trial
 * itself is entirely card-less (see create_shop RPC), so this always
 * starts a real, immediately-paid subscription, never another free trial.
 */
export async function startSubscriptionAction(shopId: string) {
  const profile = await getCurrentProfile();
  const owns = profile?.shops.some((s) => s.shopId === shopId && s.role === "owner");
  if (!profile || !owns) redirect("/settings/billing");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shop } = await supabase
    .from("shops")
    .select("billing_tier, stripe_customer_id")
    .eq("id", shopId)
    .single();
  if (!shop) redirect("/settings/billing");

  const priceId =
    shop.billing_tier === "additional"
      ? process.env.STRIPE_PRICE_ID_ADDITIONAL!
      : process.env.STRIPE_PRICE_ID!;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { shop_id: shopId } },
    metadata: { shop_id: shopId },
    ...(shop.stripe_customer_id
      ? { customer: shop.stripe_customer_id }
      : { customer_email: user?.email ?? undefined }),
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?checkout=cancelled`,
  });

  redirect(session.url!);
}

export async function openBillingPortalAction(shopId: string) {
  const profile = await getCurrentProfile();
  const owns = profile?.shops.some((s) => s.shopId === shopId && s.role === "owner");
  if (!profile || !owns) redirect("/settings/billing");

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("stripe_customer_id")
    .eq("id", shopId)
    .single();
  if (!shop?.stripe_customer_id) redirect("/settings/billing");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: shop.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  redirect(session.url);
}
