const NAME_MAX = 80;
const POSITION_MAX = 80;
const EMAIL_MAX = 254;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (name.length < 2 || name.length > NAME_MAX) {
    return { ok: false, error: "Write your name as you use it at work." };
  }
  if (position.length < 2 || position.length > POSITION_MAX) {
    return { ok: false, error: "Say the seat you occupy. Principal, technologist, intern." };
  }
  return { ok: true, value: { email: email.value, name, position } };
}
