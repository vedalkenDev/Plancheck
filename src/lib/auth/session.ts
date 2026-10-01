import { cache } from "react";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export type AllowedUser = {
  id: string;
  email: string;
};

export const getAllowedUser = cache(async (): Promise<AllowedUser | null> => {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  const id = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  if (!id || !isAllowedEmail(email)) {
    return null;
  }
  return { id, email };
});
