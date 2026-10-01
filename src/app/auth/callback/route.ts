import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { publicOrigin, safeNextPath } from "@/lib/auth/paths";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!isAllowedEmail(email)) {
    await supabase.auth.signOut();
    if (userId) {
      const admin = supabaseAdmin();
      if (admin) {
        await admin.auth.admin.deleteUser(userId);
      }
    }
    return NextResponse.redirect(new URL("/login?error=unauthorized", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
