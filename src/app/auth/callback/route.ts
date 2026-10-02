import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { publicOrigin, safeNextPath } from "@/lib/auth/paths";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = publicOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", origin));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth", origin));
  }

  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (!isAllowedEmail(email)) {
    return NextResponse.redirect(new URL("/waitlist", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
