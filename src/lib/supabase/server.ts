import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "@/lib/supabase/env";

export async function createServerSupabase() {
  const { url, key } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component. Proxy writes the refreshed cookies.
        }
      },
    },
  });
}
