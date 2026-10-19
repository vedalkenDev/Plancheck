import type { AuditSample } from "@/data/types";
import { DISCLAIMER } from "@/lib/checklist";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Overlay a visible stamp and an AcroForm notes page the architect can edit in Acrobat. */
export async function stampPdf(bytes: ArrayBuffer | Uint8Array, audit: AuditSample) {
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);
  const fail = rgb(0.72, 0.11, 0.11);
  const mute = rgb(0.42, 0.41, 0.4);

  const first = pdf.getPages()[0] ?? pdf.addPage();
  const { width, height } = first.getSize();
  const boxW = Math.min(280, width * 0.34);
  const boxH = 78;
  const x = Math.max(24, width - boxW - 28);
  const y = Math.max(24, height - boxH - 28);
  first.drawRectangle({
    x,
    y,
    width: boxW,
    height: boxH,
    color: rgb(1, 1, 1),
    borderColor: ink,
    borderWidth: 1,
  });
  first.drawText("PLANCHECK", {
    x: x + 10,
    y: y + boxH - 22,
    size: 11,
    font: bold,
    color: ink,
  });
  first.drawText(clip(audit.verdict, 46), {
    x: x + 10,
    y: y + boxH - 40,
    size: 8,
    font,
    color: audit.failed.length ? fail : ink,
  });
  first.drawText("Not a stamp. Not municipal approval.", {
    x: x + 10,
    y: y + 14,
    size: 7,
    font,
    color: mute,
  });

  const notes = pdf.addPage([595.28, 841.89]);
  const form = pdf.getForm();
  notes.drawText("Plancheck notes", { x: 48, y: 792, size: 16, font: bold, color: ink });
  notes.drawText(clip(audit.project, 70), { x: 48, y: 770, size: 11, font, color: ink });
  notes.drawText(clip(`${audit.address}  ${audit.occupancy} ${audit.occupancyNote}`, 80), {
    x: 48,
    y: 754,
    size: 10,
    font,
    color: ink,
  });
  notes.drawText(DISCLAIMER, { x: 48, y: 736, size: 8, font, color: mute });
  notes.drawText("Edit the fields below, then print or re-export this PDF for the council pack.", {
    x: 48,
    y: 720,
    size: 8,
    font,
    color: mute,
  });

  let top = 688;
  for (const row of audit.failed) {
    if (top < 120) {
      break;
    }
    notes.drawText(`${row.part}  ${row.check}`, { x: 48, y: top, size: 10, font: bold, color: fail });
    notes.drawText(clip(row.detail, 90), { x: 48, y: top - 14, size: 8, font, color: ink });
    const field = form.createTextField(`plancheck.fail.${row.id}`);
    field.setText(row.adjust);
    field.enableMultiline();
    field.addToPage(notes, {
      x: 48,
      y: top - 82,
      width: 499,
      height: 62,
      borderWidth: 1,
      borderColor: ink,
    });
    top -= 108;
  }

  form.updateFieldAppearances(font);
  return pdf.save();
}

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}
