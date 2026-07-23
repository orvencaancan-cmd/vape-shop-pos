import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { AuthCardShell } from "@/components/auth-card-shell";

export default async function BillingRequiredPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");

  return (
    <AuthCardShell
      heading="Update your billing"
      subtitle={`${profile.shop.name}'s subscription is ${profile.shop.subscriptionStatus}. Update your payment method to keep using the app.`}
      showLogout
    />
  );
}
