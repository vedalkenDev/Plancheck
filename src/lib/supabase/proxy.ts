import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { isPublicPath } from "@/lib/auth/paths";
import { hasSupabaseConfig, requireSupabaseConfig } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  if (!hasSupabaseConfig()) {
    return supabaseResponse;
  }

  const { url, key } = requireSupabaseConfig();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([header, value]) =>
          supabaseResponse.headers.set(header, value),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  const signedIn = Boolean(email);
  const allowed = isAllowedEmail(email);
  const path = request.nextUrl.pathname;

  if (allowed && (path === "/login" || path === "/waitlist")) {
    return withAuthCookies(
      supabaseResponse,
      NextResponse.redirect(new URL("/plancheck", request.url)),
    );
  }

  if (signedIn && !allowed && path === "/login") {
    return withAuthCookies(
      supabaseResponse,
      NextResponse.redirect(new URL("/waitlist", request.url)),
    );
  }

  if (!isPublicPath(path) && !allowed) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const next = signedIn ? "/waitlist" : "/login";
    return withAuthCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(next, request.url)),
    );
  }

  return supabaseResponse;
}

function withAuthCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.headers.getSetCookie()) {
    to.headers.append("Set-Cookie", cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) {
      to.headers.set(header, value);
    }
  }
  return to;
}
