"use server";

import { isAllowedEmail } from "@/lib/auth/allowlist";
import { setGateCookie } from "@/lib/auth/gate-cookie";
import { parseEmail } from "@/lib/auth/waitlist";
import { redirect } from "next/navigation";

export type EnterEmailState = {
  error: string | null;
};

export async function enterEmail(
  _previous: EnterEmailState,
  formData: FormData,
): Promise<EnterEmailState> {
  const parsed = parseEmail(formData.get("email"));
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  if (isAllowedEmail(parsed.value)) {
    await setGateCookie(parsed.value);
    redirect("/plancheck");
  }

  redirect(`/waitlist?email=${encodeURIComponent(parsed.value)}`);
}
