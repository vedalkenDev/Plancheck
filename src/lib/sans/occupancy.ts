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
const BARE = /\b([A-HJ][1-5])(?!\d)\b/;

export function occupancyFromText(blob: string) {
  const labeled = blob.match(LABELED);
  const bare = blob.match(BARE);
  const code = labeled?.[1]?.toUpperCase() ?? bare?.[1]?.toUpperCase() ?? null;
  if (!code) {
    return { code: "—", note: "not found" };
  }

  if (code === "G1" && /medical/i.test(blob)) {
    return { code, note: "medical offices" };
  }

  return { code, note: OCCUPANCY_CLASSES[code] ?? "from the drawing" };
}
