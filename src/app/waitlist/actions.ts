"use server";

import { isAllowedEmail } from "@/lib/auth/allowlist";
import { setGateCookie } from "@/lib/auth/gate-cookie";
import {
  clientIp,
  mapWaitlistSheetResult,
  parseWaitlistFields,
  rateLimitWaitlist,
} from "@/lib/auth/waitlist";
import { postWaitlistRow } from "@/lib/waitlist-sheet";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type JoinWaitlistState = {
  error: string | null;
  success: string | null;
};

const GENERIC = "Something went wrong. Please try again.";

export async function joinWaitlist(
  _previous: JoinWaitlistState,
  formData: FormData,
): Promise<JoinWaitlistState> {
  const website = formData.get("website");
  if (typeof website === "string" && website.trim()) {
    return { error: null, success: "You're on the list. We'll be in touch." };
  }

  const parsed = parseWaitlistFields({
    email: formData.get("email"),
    name: formData.get("name"),
    position: formData.get("position"),
  });
  if (!parsed.ok) {
    return { error: parsed.error, success: null };
  }

  const headerList = await headers();
  const ip = clientIp(headerList.get("x-forwarded-for"));
  if (rateLimitWaitlist(ip)) {
    console.error("Waitlist rate limit exceeded");
    return { error: GENERIC, success: null };
  }

  const utm = formData.get("utm_source");
  const source =
    typeof utm === "string" && utm.trim()
      ? utm.trim()
      : (headerList.get("referer") ?? "");

  const result = await postWaitlistRow({
    name: parsed.value.name,
    email: parsed.value.email,
    role: parsed.value.position,
    source,
    userAgent: headerList.get("user-agent") ?? "",
  });

  const saved = result.ok || (!result.ok && result.error === "duplicate");
  if (isAllowedEmail(parsed.value.email) && saved) {
    await setGateCookie(parsed.value.email);
    redirect("/plancheck");
  }

  return mapWaitlistSheetResult(result);
}
