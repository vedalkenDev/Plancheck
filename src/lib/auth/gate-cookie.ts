import { cookies } from "next/headers";
import { GATE_COOKIE, gateCookieOptions, sealGate } from "@/lib/auth/gate";

export async function setGateCookie(email: string) {
  const jar = await cookies();
  jar.set(GATE_COOKIE, sealGate(email), gateCookieOptions());
}

export async function clearGateCookie() {
  const jar = await cookies();
  jar.set(GATE_COOKIE, "", { ...gateCookieOptions(), maxAge: 0 });
}
