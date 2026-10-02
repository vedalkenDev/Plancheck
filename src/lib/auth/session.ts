import { cache } from "react";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AllowedUser = {
  id: string;
  email: string;
};

export type WaitlistRow = {
  email: string;
  name: string;
  position: string;
};

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  const id = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  if (!id || !email) {
    return null;
  }
  const name = typeof data?.claims?.name === "string" ? data.claims.name.trim() : "";
  return { id, email, name };
});

export const getAllowedUser = cache(async (): Promise<AllowedUser | null> => {
  const user = await getAuthUser();
  if (!user || !isAllowedEmail(user.email)) {
    return null;
  }
  return { id: user.id, email: user.email };
});

export const getOwnWaitlistRow = cache(async (): Promise<WaitlistRow | null> => {
  const user = await getAuthUser();
  if (!user || isAllowedEmail(user.email)) {
    return null;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("waitlist")
    .select("email, name, position")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    email: data.email,
    name: data.name,
    position: data.position,
  };
});
