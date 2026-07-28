import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { completeOnboarding } from "./actions";
import { AuthCardShell } from "@/components/auth-card-shell";
import { Button } from "@/components/ui/button";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (profile) redirect(profile.role === "owner" ? "/dashboard" : "/sell");

  const shopName = (user.user_metadata?.pending_shop_name as string) || "your shop";

  return (
    <AuthCardShell
      heading={`Set up ${shopName}`}
      subtitle="Start your 14-day free trial — no card required."
      showThemeToggle={false}
    >
      <form action={completeOnboarding}>
        <Button type="submit" className="w-full">
          Enter your shop
        </Button>
      </form>
    </AuthCardShell>
  );
}
