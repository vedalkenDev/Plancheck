import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase/env";

export function supabaseAdmin() {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
