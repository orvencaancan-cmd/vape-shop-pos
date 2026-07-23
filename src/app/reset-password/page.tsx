import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="animate-fade-in-up mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-normal text-ink">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">This will replace your current password.</p>
      </div>
      <PasswordForm />
    </main>
  );
}
