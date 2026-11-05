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
  return notesPages([MARINE_DRIVE_NOTES], false);
}

/** Same notes split across two sheets — occupancy on 1, schedule and XA on 2. */
export const MARINE_DRIVE_SET_PAGES = [
  MARINE_DRIVE_NOTES.slice(0, 7),
  MARINE_DRIVE_NOTES.slice(7),
];

export async function marineDriveSetPdf() {
  return notesPages(MARINE_DRIVE_SET_PAGES, false);
}

/** Same notes, one glyph per Tj — how many CAD SHX/plot drivers write a sheet. */
export async function marineDriveGlyphPdf() {
  return notesPages([MARINE_DRIVE_NOTES], true);
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
  return notesPages([MEASURED_WINDOW_NOTES], false);
}

/** Overall sizes plus each pane — Part N can pass from the notes. */
export const WINDOW_PANE_NOTES = [
  "Proposed dwelling",
  "14 Pane Road",
  "Occupancy H4 dwelling",
  "Fenestration Ground 7.3%",
  "Ground nett floor 100 m2",
  "Window schedule",
  "Ground W1 1800 x 1200 x2",
  "panes 600 x 1200, 1200 x 1200",
  "Ground W2 2000 x 1500 x1",
  "fixed 600 x 1500 openable 1400 x 1500",
  "Soakpit stormwater Part R",
  "Stairs 170mm riser 250mm going Part M",
];

export async function windowPaneNotesPdf() {
  return notesPages([WINDOW_PANE_NOTES], false);
}

/** Thin floor plan: room labels, titleblock scale, and millimetres on the geometry — not a notes stack. */
export async function thinFloorplanPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([1190.55, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.12, 0.11, 0.1);
  const pt = (mm: number) => (mm * 72) / 25.4 / 100;
  const x0 = 180;
  const y0 = 240;
  const w = pt(12000);
  const h = pt(8000);

  page.drawRectangle({
    x: x0,
    y: y0,
    width: w,
    height: h,
    borderWidth: 1.2,
    borderColor: ink,
  });
  page.drawLine({
    start: { x: x0 + w / 2, y: y0 },
    end: { x: x0 + w / 2, y: y0 + h },
    thickness: 0.8,
    color: ink,
  });

  const going = pt(250);
  const treadW = pt(900);
  for (let i = 0; i < 5; i += 1) {
    const y = y0 + 12 + i * going;
    page.drawLine({
      start: { x: x0 + 10, y },
      end: { x: x0 + 10 + treadW, y },
      thickness: 0.7,
      color: ink,
    });
  }

  const winX = x0 + pt(3000);
  const winW = pt(1800);
  page.drawLine({
    start: { x: winX, y: y0 - 6 },
    end: { x: winX + winW, y: y0 - 6 },
    thickness: 1.4,
    color: ink,
  });

  const write = (value: string, x: number, y: number, size = 10) => {
    page.drawText(value, { x, y, size, font, color: ink });
  };

  write("Proposed thin dwelling", 48, 800, 16);
  write("BED ROOM", x0 + 36, y0 + h * 0.55);
  write("KITCHEN", x0 + w / 2 + 28, y0 + h * 0.55);
  write("12000", x0 + w / 2 - 18, y0 - 18);
  write("8000", x0 - 36, y0 + h / 2);
  write("170", x0 + 14, y0 + 12 + going * 4 + 8);
  write("RISER", x0 + 58, y0 + 12 + going * 4 + 8);
  write("250", x0 + 14, y0 + 8);
  write("GOING", x0 + 58, y0 + 8);
  write("W1", winX + 8, y0 + 8);
  write("Ground 1800 x 1200", winX + 42, y0 + 8);

  write("W1", 760, 520);
  write("Ground 1800 x 1200", 760, 502);
  write("panes 900 x 1200, 900 x 1200", 760, 484);

  page.drawRectangle({
    x: 920,
    y: 40,
    width: 230,
    height: 110,
    borderWidth: 1,
    borderColor: ink,
  });
  write("SCALE 1:100", 936, 118, 11);
  write("Occupancy H4 dwelling", 936, 98);
  write("Ground nett floor 48 m2", 936, 80);
  write("12 Thin Road", 936, 62);

  return pdf.save();
}

/** Same Marine Drive notes, flattened to a picture with no text layer. */
export async function marineDriveRasterPdf() {
  return flattenToImagePdf(await marineDriveNotesPdf());
}

export async function flattenToImagePdf(bytes: Uint8Array) {
  const { renderPageAsImage } = await import("unpdf");
  const png = new Uint8Array(
    await renderPageAsImage(bytes, 1, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 2.5,
    }),
  );
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([842, 595]);
  page.drawImage(image, { x: 0, y: 0, width: 842, height: 595 });
  return pdf.save();
}

async function notesPages(pages: string[][], splitGlyphs: boolean) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.12, 0.11, 0.1);
  for (const notes of pages) {
    const page = pdf.addPage([842, 595]);
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
  }
  return pdf.save();
}
