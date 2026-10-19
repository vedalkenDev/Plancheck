import { after, NextResponse } from "next/server";
import { flushPostHogLogs, logPostHogInfo } from "@/lib/posthog-logs";
import { GATE_COOKIE, gateCookieOptions } from "@/lib/auth/gate";
import { publicOrigin } from "@/lib/auth/paths";

export async function POST(request: Request) {
  const origin = publicOrigin(request);
  const response = NextResponse.redirect(new URL("/login", origin), 303);
  response.cookies.set(GATE_COOKIE, "", { ...gateCookieOptions(), maxAge: 0 });
  logPostHogInfo("Authenticated session ended", {});
  after(flushPostHogLogs);
  return response;
}
