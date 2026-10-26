import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Notes taken from the Marine Drive ground-truth sheet, as a CAD plot would print them. */
export const MARINE_DRIVE_NOTES = [
  "Proposed additions and alterations to existing dwelling",
  "69 Marine Drive House Khan",
  "Erf 672 Bluff, Durban",
  "Occupancy H4 dwelling",
  "Site area 3667 m2",
  "Coverage under limit",
  "Parking 6 / 6",
  "Stairs 170mm riser 250mm going Part M",
  "Soakpit stormwater Part R",
  "Lighting under 5 W/m2",
  "XA not required",
  "Fenestration L/G 16.9% Ground 17.1%",
  "L/G nett floor 371 m2",
  "Ground nett floor 367 m2",
  "Window schedule W1-W19 unit sizes drawn",
  "Swimming pool",
  "Owner signature Blank",
  "Engineering packs to attach",
];

export async function marineDriveNotesPdf() {
  return notesPdf(MARINE_DRIVE_NOTES, false);
}

/** Same notes, one glyph per Tj — how many CAD SHX/plot drivers write a sheet. */
export async function marineDriveGlyphPdf() {
  return notesPdf(MARINE_DRIVE_NOTES, true);
}

/** Printed XA % disagrees with window sizes — Plancheck should trust the schedule. */
export const MEASURED_WINDOW_NOTES = [
  "Proposed dwelling",
  "12 Test Road",
  "Occupancy H4 dwelling",
  "Fenestration L/G 10% Ground 10%",
  "L/G nett floor 100 m2",
  "Ground nett floor 100 m2",
  "Window schedule",
  "L/G W1 2000 x 1500 x6",
  "Ground W2 2000 x 1500 x8",
];

export async function measuredWindowNotesPdf() {
  return notesPdf(MEASURED_WINDOW_NOTES, false);
}

async function notesPdf(notes: string[], splitGlyphs: boolean) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.12, 0.11, 0.1);
  page.drawText("PLAN", { x: 48, y: 555, size: 18, font, color: ink });
  page.drawRectangle({
    x: 520,
    y: 80,
    width: 260,
    height: 420,
    borderWidth: 1,
    borderColor: ink,
  });
  let y = 520;
  for (const line of notes) {
    if (splitGlyphs) {
      let x = 48;
      for (const ch of line) {
        page.drawText(ch, { x, y, size: 11, font, color: ink });
        x += font.widthOfTextAtSize(ch, 11);
      }
    } else {
      page.drawText(line, { x: 48, y, size: 11, font, color: ink });
    }
    y -= 20;
  }
  return pdf.save();
}
