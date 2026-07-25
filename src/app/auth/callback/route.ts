import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/onboarding";

  const supabase = await createClient();
  let reason = "auth";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    reason = error.code ?? reason;
  } else if (tokenHash && type) {
    // Links generated via the admin API (e.g. a manually issued access
    // link) arrive this way instead of as a PKCE `code`, since there's no
    // browser-side code verifier to exchange against.
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    reason = error.code ?? reason;
  } else {
    // Supabase appends these directly when the link itself was already
    // invalid (expired, already used) before ever reaching this route.
    const explicitError = searchParams.get("error_code") ?? searchParams.get("error");
    if (explicitError) {
      reason = explicitError;
    } else {
      // No code/token_hash and no reported error usually means this
      // project's auth email delivers the session as a URL fragment
      // (#access_token=...) instead, which never reaches the server. Hand
      // off to /auth/confirm, which reads the fragment client-side --
      // browsers reattach the original fragment across this redirect since
      // our Location header doesn't specify one of its own.
      return NextResponse.redirect(`${origin}/auth/confirm?next=${encodeURIComponent(next)}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
}
