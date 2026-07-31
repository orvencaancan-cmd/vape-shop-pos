/**
 * PayMongo's automated recurring billing is Maya-and-card only and gated
 * behind business verification we don't have yet, so subscriptions are
 * paid manually via GCash/Maya QR and approved by hand -- see
 * manual_payment_requests (0025) and /admin/payments.
 */
export const TIER_AMOUNTS: Record<"primary" | "additional", number> = {
  primary: 500,
  additional: 200,
};
