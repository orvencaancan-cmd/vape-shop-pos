import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";
import { AuthCardShell } from "@/components/auth-card-shell";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AuthCardShell heading="Choose a new password" subtitle="This will replace your current password.">
      <PasswordForm />
    </AuthCardShell>
  );
}
