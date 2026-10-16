import { createHmac, timingSafeEqual } from "node:crypto";
import { isAllowedEmail } from "@/lib/auth/allowlist";

export const GATE_COOKIE = "pc_gate";
const GATE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function gateSecret() {
  return (
    process.env.PLANCHECK_GATE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "plancheck-email-gate-v1"
  );
}

function sign(payload: string) {
  return createHmac("sha256", gateSecret()).update(payload).digest("base64url");
}

function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sealGate(email: string, now = Date.now()) {
  const exp = now + GATE_MAX_AGE_SEC * 1000;
  const payload = `${email.trim().toLowerCase()}\n${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readGate(value: string | undefined | null, now = Date.now()): string | null {
  if (!value) {
    return null;
  }
  const split = value.lastIndexOf(".");
  if (split <= 0) {
    return null;
  }
  const payload = value.slice(0, split);
  const sig = value.slice(split + 1);
  const sep = payload.lastIndexOf("\n");
  if (sep <= 0 || !equal(sig, sign(payload))) {
    return null;
  }
  const email = payload.slice(0, sep).trim().toLowerCase();
  const exp = Number(payload.slice(sep + 1));
  if (!Number.isFinite(exp) || exp < now || !isAllowedEmail(email)) {
    return null;
  }
  return email;
}

export function gateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GATE_MAX_AGE_SEC,
  };
}
