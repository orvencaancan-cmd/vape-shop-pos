import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { hasBillingAccess } from "@/lib/billing-status";
import { getPriceLabels } from "@/lib/stripe-prices";
import { AuthCardShell } from "@/components/auth-card-shell";
import { buttonClasses } from "@/components/ui/button";
import { startSubscriptionAction } from "@/app/(app)/settings/billing/actions";

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
  const prices = await getPriceLabels();
  const priceLabel = profile.shop.billingTier === "additional" ? prices?.additional : prices?.primary;
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
