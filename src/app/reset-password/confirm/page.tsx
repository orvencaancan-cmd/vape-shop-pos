"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthCardShell } from "@/components/auth-card-shell";
import { buttonClasses } from "@/components/ui/button";

// Deliberately does NOT verify the token on page load. Email providers
// (Gmail included) automatically pre-visit links in incoming mail to scan
// them for safety, which silently burns a one-time-use recovery link before
// the real person ever clicks it. Requiring an actual button click defeats
// that, since scanners fetch the page but don't interact with it.
export default function ResetPasswordConfirmPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    if (!tokenHash || type !== "recovery") {
      setStatus("error");
      setError("This link is missing some information. Request a new password reset email.");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (verifyError) {
      setStatus("error");
      setError(
        "That link has expired or was already used. Request a new password reset email.",
      );
      return;
    }

    // A staff member re-invited after never completing their first invite
    // arrives here too (see invite-staff.ts) -- send them to the "welcome
    // aboard" screen instead of "choose a new password", which would be a
    // confusing thing to see before they've ever had a password.
    if (data.user?.user_metadata?.pending_invite) {
      await supabase.auth.updateUser({ data: { pending_invite: null } });
      window.location.replace("/accept-invite");
      return;
    }
    window.location.replace("/reset-password");
  }

  if (status === "error") {
    return (
      <AuthCardShell heading="Link no longer works" subtitle={error ?? undefined}>
        <Link href="/forgot-password" className={`w-full ${buttonClasses("primary", "md")}`}>
          Request a new link
        </Link>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell
      heading="Reset your password"
      subtitle="For your security, confirm it's really you before we continue."
    >
      <button
        type="button"
        onClick={handleConfirm}
        disabled={status === "loading"}
        className={`w-full ${buttonClasses("primary", "md")}`}
      >
        {status === "loading" ? "Confirming…" : "Continue to reset password"}
      </button>
    </AuthCardShell>
  );
}
