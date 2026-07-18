import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export default async function AcceptInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome aboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Set a password so you can log in next time.
        </p>
      </div>
      <PasswordForm />
    </main>
  );
}
