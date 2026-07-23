import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completeOnboarding } from "./actions";
import { AuthCardShell } from "@/components/auth-card-shell";
import { Button } from "@/components/ui/button";

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
    <AuthCardShell
      heading={`Set up ${shopName}`}
      subtitle="Next you'll add a payment method to start your 14-day free trial — you won't be charged until it ends."
      showThemeToggle={false}
    >
      <form action={completeOnboarding}>
        <Button type="submit" className="w-full">
          Continue to billing
        </Button>
      </form>
    </AuthCardShell>
  );
}
