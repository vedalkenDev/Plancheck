"use server";

import { isAllowedEmail } from "@/lib/auth/allowlist";
import { setGateCookie } from "@/lib/auth/gate-cookie";
import { parseWaitlistFields } from "@/lib/auth/waitlist";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabaseConfig, requireSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export type JoinWaitlistState = {
  error: string | null;
};

export async function joinWaitlist(
  _previous: JoinWaitlistState,
  formData: FormData,
): Promise<JoinWaitlistState> {
  const parsed = parseWaitlistFields({
    email: formData.get("email"),
    name: formData.get("name"),
    position: formData.get("position"),
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  if (isAllowedEmail(parsed.value.email)) {
    await setGateCookie(parsed.value.email);
    redirect("/plancheck");
  }

  if (!hasSupabaseConfig()) {
    return { error: "The list did not take the name. Try once more." };
  }

  const supabase = supabaseAdmin() ?? anonClient();
  const { error } = await supabase.from("waitlist").insert({
    email: parsed.value.email,
    name: parsed.value.name,
    position: parsed.value.position,
  });
  if (error && error.code !== "23505") {
    return { error: "The list did not take the name. Try once more." };
  }

  redirect(`/waitlist?joined=1&email=${encodeURIComponent(parsed.value.email)}`);
}

function anonClient() {
  const { url, key } = requireSupabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
