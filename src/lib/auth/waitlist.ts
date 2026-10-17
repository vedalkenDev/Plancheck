const NAME_MAX = 100;
const POSITION_MAX = 100;
const EMAIL_MAX = 254;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;

// ponytail: in-memory map, per-instance on Vercel, fine for a waitlist.
const rateHits = new Map<string, number[]>();

export type WaitlistFields = {
  email: string;
  name: string;
  position: string;
};

export function parseEmail(
  input: FormDataEntryValue | string | null | undefined,
): { ok: true; value: string } | { ok: false; error: string } {
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > EMAIL_MAX) {
    return { ok: false, error: "Write an email address." };
  }
  return { ok: true, value: email };
}

export function parseWaitlistFields(input: {
  email: FormDataEntryValue | null;
  name: FormDataEntryValue | null;
  position: FormDataEntryValue | null;
}): { ok: true; value: WaitlistFields } | { ok: false; error: string } {
  const email = parseEmail(input.email);
  if (!email.ok) {
    return email;
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const position = typeof input.position === "string" ? input.position.trim() : "";
  if (name.length < 1 || name.length > NAME_MAX) {
    return { ok: false, error: "Write your name as you use it at work." };
  }
  if (position.length < 1 || position.length > POSITION_MAX) {
    return { ok: false, error: "Say the seat you occupy. Principal, technologist, intern." };
  }
  return { ok: true, value: { email: email.value, name, position } };
}

export function clientIp(forwardedFor: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || "unknown";
}

export function rateLimitWaitlist(ip: string, now = Date.now()): boolean {
  const recent = (rateHits.get(ip) ?? []).filter((stamp) => now - stamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateHits.set(ip, recent);
  return false;
}

export type WaitlistSheetResult = { ok: true } | { ok: false; error: string };

export function mapWaitlistSheetResult(result: WaitlistSheetResult): {
  error: string | null;
  success: string | null;
} {
  if (result.ok) {
    return { error: null, success: "You're on the list. We'll be in touch." };
  }
  if (result.error === "duplicate") {
    return { error: null, success: "You're already on the list." };
  }
  if (result.error === "invalid_email") {
    return { error: "Write an email address.", success: null };
  }
  return { error: "Something went wrong. Please try again.", success: null };
}
