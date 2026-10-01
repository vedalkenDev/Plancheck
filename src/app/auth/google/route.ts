import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { publicOrigin } from "@/lib/auth/paths";
import { hasSupabaseConfig, requireSupabaseConfig } from "@/lib/supabase/env";

export async function POST(request: Request) {
  const origin = publicOrigin(request);
  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin), 303);
  }

  const pending: { name: string; value: string; options: CookieOptions }[] = [];
  const cacheHeaders: Record<string, string> = {};
  const { url, key } = requireSupabaseConfig();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookies(request.headers.get("cookie"));
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options });
        });
        Object.assign(cacheHeaders, headers);
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  const location = !error && data.url ? data.url : `${origin}/login?error=oauth`;
  const response = NextResponse.redirect(location, 303);
  pending.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  Object.entries(cacheHeaders).forEach(([header, value]) => {
    response.headers.set(header, value);
  });
  return response;
}

function parseCookies(header: string | null) {
  if (!header) {
    return [];
  }
  return header.split(";").flatMap((part) => {
    const index = part.indexOf("=");
    if (index === -1) {
      return [];
    }
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) {
      return [];
    }
    return [{ name, value }];
  });
}
