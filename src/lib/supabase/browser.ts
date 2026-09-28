import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browser: SupabaseClient | null = null;

export function supabaseBrowser() {
  if (browser) {
    return browser;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL and anon key are missing");
  }
  browser = createClient(url, key);
  return browser;
}
