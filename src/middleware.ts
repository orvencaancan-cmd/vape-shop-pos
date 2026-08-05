import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/auth",
  "/forgot-password",
  "/reset-password/confirm",
  "/accept-invite/confirm",
  "/contact",
  "/terms",
  "/privacy",
];

// This file must be named exactly "middleware.ts" (at the project root or,
// with a src/ layout like this one, at src/middleware.ts) for Next.js to
// actually run it -- it previously lived at src/proxy.ts under the name
// proxy(), which is not a filename/export Next.js's routing layer
// recognizes, so none of this logic was ever executing. In particular,
// nothing was refreshing the session cookie: the access token just expired
// on its normal ~1 hour lifetime while a tab sat open, and the next server
// request failed auth and redirected to /login even though the refresh
// token was still perfectly valid.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && !isPublic && !pathname.startsWith("/api/webhooks")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Role- and subscription-based gating (redirect to /billing-required,
  // /login, or role-appropriate landing pages) happens in
  // src/lib/auth/require-profile.ts on each protected route/layout, since
  // it needs a profile+shop lookup that's cheaper to do once per route
  // tree via a shared server component than on every single request here.

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
