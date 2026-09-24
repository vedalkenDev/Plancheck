/** SANS 10400-A Table 1 occupancy classes. A20 is the regulation that requires a class — not a class itself. */
export const OCCUPANCY_CLASSES: Record<string, string> = {
  A1: "entertainment and public assembly",
  A2: "theatrical and indoor sport",
  A3: "places of instruction",
  A4: "worship",
  A5: "outdoor sport",
  B1: "high risk commercial service",
  B2: "moderate risk commercial service",
  B3: "low risk commercial service",
  C1: "exhibition hall",
  C2: "museum",
  D1: "high risk industrial",
  D2: "moderate risk industrial",
  D3: "low risk industrial",
  D4: "plant room",
  E1: "place of detention",
  E2: "hospital",
  E3: "other institutional (residential)",
  E4: "health care",
  F1: "large shop",
  F2: "small shop",
  F3: "wholesaler's store",
  G1: "offices",
  H1: "hotel",
  H2: "dormitory",
  H3: "domestic residence",
  H4: "dwelling",
  H5: "hospitality",
  J1: "high risk storage",
  J2: "moderate risk storage",
  J3: "low risk storage",
  J4: "parking garage",
};

const LABELED = /occupancy\s*[:#]?\s*([A-HJ][1-5])(?!\d)/i;

export function occupancyFromText(blob: string) {
  const named = namedClass(blob);
  const labeled = blob.match(LABELED);
  const code = named?.code ?? labeled?.[1]?.toUpperCase() ?? null;
  if (!code) {
    return { code: "—", note: "not found" };
  }
  if (code === "G1" && /medical/i.test(blob)) {
    return { code, note: "medical offices" };
  }
  return { code, note: named?.note ?? OCCUPANCY_CLASSES[code] ?? "from the drawing" };
}

function namedClass(blob: string) {
  const hits = [...blob.matchAll(/\b([A-HJ][1-5])(?!\d)/g)];
  let best: { code: string; note: string; words: number } | null = null;
  for (let i = 0; i < hits.length; i++) {
    const code = hits[i][1].toUpperCase();
    const note = OCCUPANCY_CLASSES[code];
    if (!note) {
      continue;
    }
    const start = (hits[i].index ?? 0) + hits[i][0].length;
    const end = hits[i + 1]?.index ?? blob.length;
    const phrase = blob
      .slice(start, end)
      .replace(/^\s*[-–—:]?\s*/, "")
      .toLowerCase();
    const words = note.split(/\s+/).filter((word) => word.length >= 5 && phrase.includes(word));
    if (!words.length) {
      continue;
    }
    if (!best || words.length > best.words) {
      best = { code, note, words: words.length };
    }
  }
  return best;
}
