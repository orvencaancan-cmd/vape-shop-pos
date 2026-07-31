import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { hasBillingAccess } from "@/lib/billing-status";
import { TIER_AMOUNTS } from "@/lib/manual-payment";
import { AuthCardShell } from "@/components/auth-card-shell";
import { buttonClasses } from "@/components/ui/button";

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
  const amount = TIER_AMOUNTS[profile.shop.billingTier];

  return (
    <AuthCardShell
      heading={heading}
      subtitle={
        <>
          {profile.shop.name}&apos;s data is safe and waiting — you just need an active
          subscription to keep using it. ₱{amount.toFixed(2)} PHP / month.
        </>
      }
      showLogout
    >
      <Link href="/settings/billing" className={`block w-full text-center ${buttonClasses("primary", "md")}`}>
        Go to Billing
      </Link>
    </AuthCardShell>
  );
}
