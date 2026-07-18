"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("shop_id, role")
    .eq("id", user.id)
    .maybeSingle();

  let shopId = existingProfile?.shop_id as string | undefined;

  if (!shopId) {
    const shopName = (user.user_metadata?.pending_shop_name as string) || "My Shop";
    const displayName =
      (user.user_metadata?.pending_display_name as string | undefined) ?? null;

    const { data, error } = await supabase.rpc("create_shop", {
      shop_name: shopName,
      owner_display_name: displayName,
    });
    if (error) throw new Error(error.message);
    shopId = data as string;
  } else {
    // Already onboarded (e.g. re-clicked). Send them where they belong.
    redirect(existingProfile!.role === "owner" ? "/dashboard" : "/sell");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { shop_id: shopId },
    },
    metadata: { shop_id: shopId },
    customer_email: user.email ?? undefined,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?checkout=cancelled`,
  });

  redirect(session.url!);
}
