type ShopBillingFields = {
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

/**
 * Live-computed, not stored: this app has no cron/scheduled-job
 * infrastructure, so instead of flipping subscription_status to a 5th
 * "expired" value when the trial ends, expiry is derived from trial_ends_at
 * on every read. null trial_ends_at (every shop that existed before this
 * feature shipped) means "never expires" -- nothing is retroactively locked.
 */
export function isTrialExpired(shop: ShopBillingFields): boolean {
  if (shop.subscriptionStatus !== "trialing") return false;
  if (!shop.trialEndsAt) return false;
  return new Date(shop.trialEndsAt).getTime() < Date.now();
}

/**
 * Subscriptions are paid manually now (no Stripe webhook to flip status on
 * a missed renewal), so an "active" shop past its current_period_end is
 * treated the same as trial-expired -- locked out until the owner submits
 * another manual payment. Also live-computed, not stored, for the same
 * reason as isTrialExpired.
 */
export function isPeriodExpired(shop: ShopBillingFields): boolean {
  if (shop.subscriptionStatus !== "active") return false;
  if (!shop.currentPeriodEnd) return false;
  return new Date(shop.currentPeriodEnd).getTime() < Date.now();
}

/** past_due/canceled lock out immediately -- no grace window. */
export function hasBillingAccess(shop: ShopBillingFields): boolean {
  if (shop.subscriptionStatus === "active") return !isPeriodExpired(shop);
  if (shop.subscriptionStatus === "trialing") return !isTrialExpired(shop);
  return false;
}

export function daysUntilTrialEnd(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
}

export function statusLabel(shop: ShopBillingFields): string {
  if (isTrialExpired(shop)) return "Trial expired";
  if (isPeriodExpired(shop)) return "Payment due";
  switch (shop.subscriptionStatus) {
    case "trialing":
      return "Free trial";
    case "active":
      return "Active";
    case "past_due":
      return "Payment past due";
    case "canceled":
      return "Canceled";
    default:
      return shop.subscriptionStatus;
  }
}
