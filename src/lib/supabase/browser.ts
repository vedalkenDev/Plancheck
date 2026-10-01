import { createBrowserSupabase } from "@/lib/supabase/client";

export function supabaseBrowser() {
  return createBrowserSupabase();
}
