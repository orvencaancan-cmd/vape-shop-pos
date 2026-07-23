import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function BillingRequiredPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.shop.isPlatformShop) redirect("/admin");

  return (
    <main className="animate-fade-in-up mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <h1 className="font-serif text-2xl font-normal text-ink">
        Update your billing
      </h1>
      <p className="text-sm text-muted">
        {profile.shop.name}&apos;s subscription is {profile.shop.subscriptionStatus}.
        Update your payment method to keep using the app.
      </p>
    </main>
  );
}
