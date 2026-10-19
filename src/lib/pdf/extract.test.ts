import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { auditFromDrawing } from "../cad/audit-from-drawing";
import { extractPdf } from "./extract";
import { marineDriveNotesPdf } from "./fixture";
import { stampPdf } from "./stamp";

describe("pdf council set", () => {
  it("runs the Marine Drive checks from a plotted notes PDF and writes an editable stamp", async () => {
    const bytes = await marineDriveNotesPdf();

    const extract = await extractPdf("marine-drive-notes.pdf", bytes);
    assert.equal(extract.format, "pdf");
    assert.ok(extract.strings.some((line) => /Occupancy H4 dwelling/i.test(line)));

    const audit = auditFromDrawing("marine-drive-notes.pdf", extract);
    assert.equal(audit.format, "pdf");
    assert.equal(audit.occupancy, "H4");
    assert.equal(audit.occupancyNote, "dwelling");
    assert.match(audit.address, /69 Marine Drive/);

    const xa = audit.failed.find((row) => row.id === "xa-fenestration");
    assert.ok(xa);
    assert.match(xa.detail, /16\.9%/);
    assert.match(xa.detail, /17\.1%/);
    assert.match(xa.adjust, /7\.05 m²/);
    assert.match(xa.adjust, /7\.71 m²/);

    const failed = audit.failed.map((row) => row.id);
    assert.ok(failed.includes("part-d"));
    assert.ok(failed.includes("signatures"));
    assert.ok(failed.includes("eng-packs"));
    assert.ok(audit.passed.map((row) => row.id).includes("window-schedule"));

    const stamped = await stampPdf(bytes, audit);
    const annotated = await PDFDocument.load(stamped);
    assert.equal(annotated.getPageCount(), 2);
    const field = annotated.getForm().getTextField("plancheck.fail.xa-fenestration");
    assert.match(field.getText() ?? "", /SANS 204/);
  });

  it("fails readable text when the PDF has no notes", async () => {
    const empty = await PDFDocument.create();
    empty.addPage();
    const bytes = await empty.save();
    const extract = await extractPdf("blank.pdf", bytes);
    const audit = auditFromDrawing("blank.pdf", extract);
    assert.equal(audit.failed.some((row) => row.id === "readable-text"), true);
  });
});
