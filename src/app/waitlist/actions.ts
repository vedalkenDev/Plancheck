"use server";

import { isAllowedEmail } from "@/lib/auth/allowlist";
import { getAuthUser } from "@/lib/auth/session";
import { parseWaitlistFields } from "@/lib/auth/waitlist";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type JoinWaitlistState = {
  error: string | null;
};

export async function joinWaitlist(
  _previous: JoinWaitlistState,
  formData: FormData,
): Promise<JoinWaitlistState> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  if (isAllowedEmail(user.email)) {
    redirect("/plancheck");
  }

  const parsed = parseWaitlistFields({
    name: formData.get("name"),
    position: formData.get("position"),
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("waitlist").insert({
    user_id: user.id,
    email: user.email,
    name: parsed.value.name,
    position: parsed.value.position,
  });
  if (error && error.code !== "23505") {
    return { error: "The list did not take the name. Try once more." };
  }

  redirect("/waitlist?joined=1");
}
