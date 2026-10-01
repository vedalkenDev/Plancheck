import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "@/lib/supabase/env";

export function createBrowserSupabase() {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient(url, key);
}
