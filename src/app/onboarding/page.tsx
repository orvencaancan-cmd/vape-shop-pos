import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) redirect(profile.role === "owner" ? "/dashboard" : "/sell");

  const shopName = (user.user_metadata?.pending_shop_name as string) || "your shop";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">
        Set up {shopName}
      </h1>
      <p className="text-sm text-slate-500">
        Next you&apos;ll add a payment method to start your 14-day free
        trial — you won&apos;t be charged until it ends.
      </p>
      <form action={completeOnboarding}>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Continue to billing
        </button>
      </form>
    </main>
  );
}
