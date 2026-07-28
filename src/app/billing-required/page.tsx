import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { hasBillingAccess } from "@/lib/billing-status";
import { getStripe } from "@/lib/stripe";
import { AuthCardShell } from "@/components/auth-card-shell";
import { buttonClasses } from "@/components/ui/button";
import { startSubscriptionAction } from "@/app/(app)/settings/billing/actions";

async function getPriceLabel(billingTier: "primary" | "additional") {
  const priceId =
    billingTier === "additional"
      ? process.env.STRIPE_PRICE_ID_ADDITIONAL
      : process.env.STRIPE_PRICE_ID;
  if (!priceId) return null;
  try {
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    const amount = (price.unit_amount ?? 0) / 100;
    return `${amount.toFixed(2)} ${price.currency.toUpperCase()} / month`;
  } catch {
    return null;
  }
}

export default async function BillingRequiredPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.platformAdmin || hasBillingAccess(profile.shop)) {
    redirect(profile.role === "owner" ? "/dashboard" : "/sell");
  }

  if (profile.role !== "owner") {
    return (
      <AuthCardShell
        heading="This shop's subscription needs attention"
        subtitle={`Ask ${profile.shop.name}'s owner to take care of billing before you can keep using VapeStock here. Nothing's been lost — your data is safe and waiting.`}
        showLogout
      />
    );
  }

  const heading =
    profile.shop.subscriptionStatus === "trialing"
      ? "Your trial has ended"
      : "Payment needs attention";
  const priceLabel = await getPriceLabel(profile.shop.billingTier);
  const boundStartSubscription = startSubscriptionAction.bind(null, profile.shopId);

  return (
    <AuthCardShell
      heading={heading}
      subtitle={
        <>
          {profile.shop.name}&apos;s data is safe and waiting — you just need an active
          subscription to keep using it.
          {priceLabel && <> {priceLabel}.</>}
        </>
      }
      showLogout
    >
      <form action={boundStartSubscription}>
        <button type="submit" className={`w-full ${buttonClasses("primary", "md")}`}>
          Subscribe
        </button>
      </form>
    </AuthCardShell>
  );
}
