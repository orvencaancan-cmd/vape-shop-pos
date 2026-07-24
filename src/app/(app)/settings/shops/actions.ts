"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getStripe } from "@/lib/stripe";

export type ActionState = { error?: string };

const schema = z.object({ shopName: z.string().min(1, "Shop name is required") });

export async function addShopAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({ shopName: formData.get("shopName") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") return { error: "Only shop owners can add another shop" };

  const supabase = await createClient();
  const { data: shopId, error } = await supabase.rpc("create_shop", {
    shop_name: parsed.data.shopName,
    owner_display_name: profile.displayName,
  });
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { shop_id: shopId },
    },
    metadata: { shop_id: shopId },
    customer_email: user?.email ?? undefined,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/shops?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/shops?checkout=cancelled`,
  });

  redirect(session.url!);
}
