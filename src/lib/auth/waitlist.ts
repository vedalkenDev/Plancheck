const NAME_MAX = 80;
const POSITION_MAX = 80;

export type WaitlistFields = {
  name: string;
  position: string;
};

export function parseWaitlistFields(input: {
  name: FormDataEntryValue | null;
  position: FormDataEntryValue | null;
}): { ok: true; value: WaitlistFields } | { ok: false; error: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const position = typeof input.position === "string" ? input.position.trim() : "";
  if (name.length < 2 || name.length > NAME_MAX) {
    return { ok: false, error: "Write your name as you use it at work." };
  }
  if (position.length < 2 || position.length > POSITION_MAX) {
    return { ok: false, error: "Say the seat you occupy. Principal, technologist, intern." };
  }
  return { ok: true, value: { name, position } };
}
