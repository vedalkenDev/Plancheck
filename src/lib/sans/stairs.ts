/** Deemed-to-satisfy Part M limits used by the engine. Not the book. */
export const MAX_RISER_MM = 200;
export const MIN_GOING_MM = 250;

export type StairReading = {
  riserMm?: number;
  goingMm?: number;
};

const TOKEN =
  /(\d+(?:\.\d+)?)\s*(mm|m)\b|(risers?|goings?|treads?)/gi;

type SizeTok = { kind: "size"; mm: number; used: boolean };
type LabelTok = { kind: "label"; name: "riser" | "going" };
type Tok = SizeTok | LabelTok;

export function readStairs(blob: string): StairReading {
  const tokens = tokenize(blob);
  const reading: StairReading = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.kind !== "label") {
      continue;
    }
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    const size =
      prev?.kind === "size" && !prev.used
        ? prev
        : next?.kind === "size" && !next.used
          ? next
          : undefined;
    if (!size) {
      continue;
    }
    size.used = true;
    if (token.name === "riser" && reading.riserMm === undefined) {
      reading.riserMm = size.mm;
    }
    if (token.name === "going" && reading.goingMm === undefined) {
      reading.goingMm = size.mm;
    }
  }

  return reading;
}

function tokenize(blob: string): Tok[] {
  const tokens: Tok[] = [];
  for (const match of blob.matchAll(TOKEN)) {
    if (match[1] !== undefined) {
      const mm = toMm(Number.parseFloat(match[1]), match[2]);
      if (mm !== undefined) {
        tokens.push({ kind: "size", mm, used: false });
      }
      continue;
    }
    const word = match[3]?.toLowerCase() ?? "";
    if (word.startsWith("riser")) {
      tokens.push({ kind: "label", name: "riser" });
    } else if (word.startsWith("going") || word.startsWith("tread")) {
      tokens.push({ kind: "label", name: "going" });
    }
  }
  return tokens;
}

function toMm(value: number, unit: string) {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  const mm = unit.toLowerCase() === "m" ? value * 1000 : value;
  if (mm < 80 || mm > 400) {
    return undefined;
  }
  return Math.round(mm);
}
