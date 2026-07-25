"use client";

import { useEffect } from "react";

// Supabase's default auth-email redirect (used whenever an email is sent
// without an explicit redirectTo, e.g. a password reset triggered from the
// Supabase dashboard instead of our own /forgot-password form) lands here
// with the session tokens in the URL fragment, which the server can never
// see. Hand it off to /auth/confirm, which parses the fragment client-side
// and establishes the session.
export function AuthHashRedirect() {
  useEffect(() => {
    if (window.location.hash.includes("access_token=")) {
      window.location.replace(`/auth/confirm${window.location.hash}`);
    }
  }, []);

  return null;
}
