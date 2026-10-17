import "server-only";

import type { WaitlistSheetResult } from "@/lib/auth/waitlist";

export async function postWaitlistRow(input: {
  name: string;
  email: string;
  role: string;
  source: string;
  userAgent: string;
}): Promise<WaitlistSheetResult> {
  const url = process.env.WAITLIST_SHEET_URL;
  const secret = process.env.WAITLIST_SECRET;
  if (!url || !secret) {
    const missing = [
      url ? null : "WAITLIST_SHEET_URL",
      secret ? null : "WAITLIST_SECRET",
    ].filter(Boolean);
    console.error(`Waitlist sheet is not configured: missing ${missing.join(", ")}`);
    return { ok: false, error: "server_not_configured" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        name: input.name,
        email: input.email,
        role: input.role,
        company: "",
        source: input.source,
        userAgent: input.userAgent,
      }),
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = (await response.json()) as { ok?: unknown; error?: unknown };
    if (data.ok === true) {
      return { ok: true };
    }
    const error = typeof data.error === "string" ? data.error : "server_error";
    console.error("Waitlist sheet rejected the submission", error);
    return { ok: false, error };
  } catch (error) {
    console.error("Waitlist sheet request failed", error);
    return { ok: false, error: "server_error" };
  }
}
