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
    <main className="animate-fade-in-up mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 text-center">
      <h1 className="font-serif text-3xl font-normal text-ink">
        Set up {shopName}
      </h1>
      <p className="text-sm text-body">
        Next you&apos;ll add a payment method to start your 14-day free
        trial — you won&apos;t be charged until it ends.
      </p>
      <form action={completeOnboarding}>
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
        >
          Continue to billing
        </button>
      </form>
    </main>
  );
}
