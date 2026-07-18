import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { toShopSubscriptionStatus } from "@/lib/stripe-status";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const shopId = session.metadata?.shop_id;
      if (!shopId || typeof session.subscription !== "string") break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      await supabase
        .from("shops")
        .update({
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id: subscription.id,
          subscription_status: toShopSubscriptionStatus(subscription.status),
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        })
        .eq("id", shopId);
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const shopId = subscription.metadata?.shop_id;
      const status = toShopSubscriptionStatus(subscription.status);

      const query = supabase
        .from("shops")
        .update({
          subscription_status: status,
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        });

      if (shopId) {
        await query.eq("id", shopId);
      } else {
        // Fallback for events that arrive without our metadata attached.
        await query.eq("stripe_subscription_id", subscription.id);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
