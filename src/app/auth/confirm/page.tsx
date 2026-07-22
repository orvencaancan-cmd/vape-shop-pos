"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthConfirmPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const next = new URLSearchParams(window.location.search).get("next") ?? "/onboarding";

    if (!accessToken || !refreshToken) {
      window.location.replace("/login?error=auth");
      return;
    }

    const supabase = createClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(
      ({ error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        window.location.replace(next);
      },
    );
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-sm text-muted">{error ? `Sign-in failed: ${error}` : "Signing you in…"}</p>
    </main>
  );
}
