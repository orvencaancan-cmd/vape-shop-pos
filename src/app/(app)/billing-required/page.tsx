import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function BillingRequiredPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">
        Update your billing
      </h1>
      <p className="text-sm text-slate-500">
        {profile.shop.name}&apos;s subscription is {profile.shop.subscriptionStatus}.
        Update your payment method to keep using the app.
      </p>
    </main>
  );
}
