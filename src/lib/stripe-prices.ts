import { getStripe } from "@/lib/stripe";

export type PriceLabels = { primary: string; additional: string };

/** Fetches both subscription tiers' display labels in one place -- reused
 * by the landing page, the billing pages, and the lockout screen so there's
 * one source of truth for "what does this cost" formatting. */
export async function getPriceLabels(): Promise<PriceLabels | null> {
  const primaryId = process.env.STRIPE_PRICE_ID;
  const additionalId = process.env.STRIPE_PRICE_ID_ADDITIONAL;
  if (!primaryId || !additionalId) return null;
  try {
    const stripe = getStripe();
    const [primary, additional] = await Promise.all([
      stripe.prices.retrieve(primaryId),
      stripe.prices.retrieve(additionalId),
    ]);
    const currency = primary.currency.toUpperCase();
    return {
      primary: `${((primary.unit_amount ?? 0) / 100).toFixed(2)} ${currency} / month`,
      additional: `${((additional.unit_amount ?? 0) / 100).toFixed(2)} ${currency} / month`,
    };
  } catch {
    return null;
  }
}
