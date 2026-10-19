import type { AuditSample } from "@/data/types";
import type { DrawingExtract } from "@/lib/cad/extract";
import { DISCLAIMER } from "@/lib/checklist";
import { cardsFromAudit, layoutNoteCards, type NoteCard, type PlacedCard } from "@/lib/pdf/space";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Draw failed checks into empty paper on the sheet. Overflow goes to a notes page. */
export async function stampPdf(
  bytes: ArrayBuffer | Uint8Array,
  audit: AuditSample,
  extract?: DrawingExtract,
) {
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const remaining = cardsFromAudit(audit);

  if (extract) {
    const pages = pdf.getPages();
    for (let index = 0; index < pages.length && remaining.length; index += 1) {
      const page = pages[index];
      const { width, height } = page.getSize();
      const sheet = extract.sheets[index];
      const geometry = sheet?.geometry ?? (index === 0 ? extract.geometry : []);
      const { placed, leftover } = layoutNoteCards(geometry, { width, height }, remaining);
      remaining.length = 0;
      remaining.push(...leftover);
      for (const item of placed) {
        drawCard(page, item, font, bold);
      }
    }
  }

  if (!remaining.length) {
    return pdf.save();
  }

  drawNotesPage(pdf, audit, remaining, font, bold);
  return pdf.save();
}

function drawCard(page: PDFPage, item: PlacedCard, font: PDFFont, bold: PDFFont) {
  const { rect, card } = item;
  const fail = card.id !== "verdict";
  const ink = rgb(0.11, 0.1, 0.09);
  const accent = fail ? rgb(0.72, 0.11, 0.11) : ink;
  const mute = rgb(0.42, 0.41, 0.4);
  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.w,
    height: rect.h,
    color: rgb(1, 1, 1),
    borderColor: accent,
    borderWidth: 1,
    opacity: 0.96,
  });
  const pad = 8;
  const titleSize = 9;
  const bodySize = 7.5;
  const width = rect.w - pad * 2;
  let y = rect.y + rect.h - pad - titleSize;
  page.drawText(clip(card.title, 48), {
    x: rect.x + pad,
    y,
    size: titleSize,
    font: bold,
    color: accent,
  });
  y -= titleSize + 4;
  const lines = wrap(font, clipAnsi(card.body), bodySize, width);
  const leading = bodySize + 2;
  for (const line of lines) {
    if (y < rect.y + pad) {
      break;
    }
    page.drawText(line, {
      x: rect.x + pad,
      y,
      size: bodySize,
      font,
      color: line.startsWith("Not a stamp") ? mute : ink,
    });
    y -= leading;
  }
}

function drawNotesPage(
  pdf: PDFDocument,
  audit: AuditSample,
  leftover: NoteCard[],
  font: PDFFont,
  bold: PDFFont,
) {
  const notes = pdf.addPage([595.28, 841.89]);
  const form = pdf.getForm();
  const ink = rgb(0.11, 0.1, 0.09);
  const fail = rgb(0.72, 0.11, 0.11);
  const mute = rgb(0.42, 0.41, 0.4);
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
  notes.drawText("These notes did not fit in empty paper on the drawing.", {
    x: 48,
    y: 720,
    size: 8,
    font,
    color: mute,
  });

  let top = 688;
  const fails = leftover.filter((card) => card.id !== "verdict");
  const rows = fails.length
    ? audit.failed.filter((row) => fails.some((card) => card.id === row.id))
    : audit.failed;
  for (const row of rows) {
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
}

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const paragraphs = text.split("\n").map((part) => part.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) {
        lines.push(line);
      }
      line = word;
    }
    if (line) {
      lines.push(line);
    }
  }
  return lines;
}

function clip(value: string, max: number) {
  const text = clipAnsi(value.replace(/\s+/g, " ").trim());
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}

function clipAnsi(value: string) {
  return [...value].filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127).join("");
}
