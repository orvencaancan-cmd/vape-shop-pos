import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";
import { AuthCardShell } from "@/components/auth-card-shell";

export default async function AcceptInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AuthCardShell heading="Welcome aboard" subtitle="Set a password so you can log in next time.">
      <PasswordForm />
    </AuthCardShell>
  );
}
