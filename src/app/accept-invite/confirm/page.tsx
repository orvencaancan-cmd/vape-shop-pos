"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthCardShell } from "@/components/auth-card-shell";
import { buttonClasses } from "@/components/ui/button";

// Same reasoning as /reset-password/confirm: email providers auto-visit
// links to scan them, which would otherwise burn this one-time invite link
// before the invited staff member ever clicks it. Verification only
// happens on a real button click.
export default function AcceptInviteConfirmPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    if (!tokenHash || type !== "invite") {
      setStatus("error");
      setError("This link is missing some information. Ask your shop admin to resend the invite.");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    });
    if (verifyError) {
      setStatus("error");
      setError("That invite link has expired or was already used. Ask your shop admin to resend it.");
      return;
    }
    window.location.replace("/accept-invite");
  }

  if (status === "error") {
    return (
      <AuthCardShell heading="Invite link no longer works" subtitle={error ?? undefined}>
        <Link href="/login" className={`w-full ${buttonClasses("secondary", "md")}`}>
          Go to login
        </Link>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell
      heading="You've been invited"
      subtitle="For your security, confirm it's really you before we continue."
    >
      <button
        type="button"
        onClick={handleConfirm}
        disabled={status === "loading"}
        className={`w-full ${buttonClasses("primary", "md")}`}
      >
        {status === "loading" ? "Confirming…" : "Continue"}
      </button>
    </AuthCardShell>
  );
}
