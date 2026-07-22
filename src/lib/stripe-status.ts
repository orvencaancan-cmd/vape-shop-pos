import type Stripe from "stripe";

export type ShopSubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

/** Maps Stripe's richer subscription statuses onto the four our schema tracks. */
export function toShopSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status,
): ShopSubscriptionStatus {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "past_due";
  }
}

/** current_period_end lives on the subscription item, not the subscription itself, in this API version. */
export function getCurrentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}
