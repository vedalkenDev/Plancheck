import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { auditFromDrawing } from "@/lib/cad/audit-from-drawing";
import type { DrawingExtract } from "@/lib/cad/extract";
import { extractPdf } from "@/lib/pdf/extract";
import { marineDriveNotesPdf } from "@/lib/pdf/fixture";
import { stampPdf } from "@/lib/pdf/stamp";
import { cardsFromCorrections, correctionsFromAudit } from "./correct";

function extractFrom(lines: string[]): DrawingExtract {
  const texts = lines.map((value) => ({ kind: "text" as const, value }));
  return {
    format: "pdf",
    texts,
    strings: lines,
    entityCounts: { TEXT: lines.length },
    geometry: [],
    sheets: [{ name: "Sheet 1", geometry: [], texts, strings: lines }],
  };
}

const G1_OFFICES = [
  "Proposed medical offices",
  "Occupancy G1 medical offices",
  "12 Office Road",
  "Stairs 170mm riser 250mm going Part M",
  "Lighting under 5 W/m2",
];

describe("correctionsFromAudit", () => {
  it("writes Part R, Part T, and XA notes, and skips signatures", () => {
    const audit = auditFromDrawing("offices.pdf", extractFrom(G1_OFFICES));
    const plan = correctionsFromAudit(audit);
    const add = plan.add.map((row) => row.id).sort();
    assert.ok(add.includes("part-r"));
    assert.ok(add.includes("part-t"));
    assert.ok(add.includes("xa-fenestration"));
    assert.match(
      plan.add.find((row) => row.id === "part-r")?.body ?? "",
      /soak pit/i,
    );
    assert.match(
      plan.add.find((row) => row.id === "part-t")?.body ?? "",
      /Fire protection/i,
    );
    assert.match(
      plan.add.find((row) => row.id === "part-t")?.body ?? "",
      /G1 medical offices/,
    );
    const skip = plan.skip.map((row) => row.id);
    assert.ok(skip.includes("signatures"));
    assert.ok(skip.includes("part-m") === false);
  });

  it("adds a Part D enclosure block on Marine Drive, not a fake XA cut", async () => {
    const bytes = await marineDriveNotesPdf();
    const extract = await extractPdf("marine-drive-notes.pdf", bytes);
    const audit = auditFromDrawing("marine-drive-notes.pdf", extract);
    const plan = correctionsFromAudit(audit);
    assert.ok(plan.add.some((row) => row.id === "part-d"));
    assert.match(
      plan.add.find((row) => row.id === "part-d")?.body ?? "",
      /1\.2 m/,
    );
    const xa = plan.add.find((row) => row.id === "xa-fenestration");
    assert.ok(xa);
    assert.match(xa.body, /SANS 204/);
    assert.doesNotMatch(xa.body, /7\.05/);
    const skip = plan.skip.map((row) => row.id);
    assert.ok(skip.includes("signatures"));
    assert.ok(skip.includes("eng-packs"));
  });

  it("stamps the missing notes so a re-read finds Part R and Part T", async () => {
    const audit = auditFromDrawing("offices.pdf", extractFrom(G1_OFFICES));
    const blank = await PDFDocument.create();
    const page = blank.addPage([842, 595]);
    page.drawText("Occupancy G1 medical offices", { x: 40, y: 540, size: 12 });
    const bytes = await blank.save();
    const extract = await extractPdf("offices.pdf", bytes);
    const stamped = await stampPdf(bytes, audit, extract, {
      kind: "correct",
      cards: cardsFromCorrections(audit),
    });
    const placed = await extractPdf("offices-corrected.pdf", stamped);
    assert.ok(placed.strings.some((line) => /PLANCHECK CORRECTOR/i.test(line)));
    assert.ok(placed.strings.some((line) => /soak pit/i.test(line)));
    assert.ok(placed.strings.some((line) => /Fire protection/i.test(line)));

    const again = auditFromDrawing("offices-corrected.pdf", placed);
    assert.equal(
      again.failed.some((row) => row.id === "part-r"),
      false,
      "Part R should pass after the soakpit note is on the sheet",
    );
    assert.equal(
      again.failed.some((row) => row.id === "part-t"),
      false,
      "Part T should pass after the fire-protection note is on the sheet",
    );
  });
});
