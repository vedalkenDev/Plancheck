import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { auditFromDrawing } from "../cad/audit-from-drawing";
import { extractDrawing } from "../cad/extract";
import { extractPdf } from "./extract";
import { marineDriveGlyphPdf, marineDriveNotesPdf } from "./fixture";
import { plotDrawingPdf } from "./plot";
import { stampPdf } from "./stamp";
import { reconstructPdfLines } from "./text";

function loadSample(name: string) {
  const bytes = readFileSync(`public/samples/${name}`);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

describe("pdf council set", () => {
  it("runs the Marine Drive checks from a plotted notes PDF and writes an editable stamp", async () => {
    const bytes = await marineDriveNotesPdf();

    const extract = await extractPdf("marine-drive-notes.pdf", bytes);
    assert.equal(extract.format, "pdf");
    assert.ok(extract.strings.some((line) => /Occupancy H4 dwelling/i.test(line)));
    assert.ok(extract.geometry.some((entity) => entity.kind === "polyline"));

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

  it("reassembles glyph-split CAD plot text into the Marine Drive notes", async () => {
    const bytes = await marineDriveGlyphPdf();
    const extract = await extractPdf("marine-drive-glyphs.pdf", bytes);
    assert.ok(extract.strings.some((line) => /Occupancy H4 dwelling/i.test(line)));
    assert.equal(
      extract.strings.some((line) => line === "O"),
      false,
    );

    const audit = auditFromDrawing("marine-drive-glyphs.pdf", extract);
    assert.equal(audit.occupancy, "H4");
    assert.match(audit.address, /69 Marine Drive/);
    const xa = audit.failed.find((row) => row.id === "xa-fenestration");
    assert.ok(xa);
    assert.match(xa.detail, /16\.9%/);
    assert.match(xa.adjust, /7\.05 m²/);
  });

  it("reads room labels and wall geometry from a public villa floor-plan PDF", async () => {
    const bytes = loadSample("747-villa.pdf");
    const extract = await extractPdf("747-villa.pdf", bytes);
    assert.ok(extract.strings.includes("GALLERY"));
    assert.ok(extract.strings.includes("KITCHEN"));
    assert.ok(extract.strings.includes("BED ROOM 1"));
    assert.ok(extract.geometry.some((entity) => entity.kind === "polyline"));
    assert.ok((extract.entityCounts.POLYLINE ?? 0) > 20);

    const audit = auditFromDrawing("747-villa.pdf", extract);
    assert.equal(audit.failed.some((row) => row.id === "readable-text"), false);
  });

  it("reads the plotted Marine Drive DXF sheet as a council PDF", async () => {
    const bytes = loadSample("marine-drive.pdf");
    const extract = await extractPdf("marine-drive.pdf", bytes);
    const audit = auditFromDrawing("marine-drive.pdf", extract);
    assert.equal(audit.occupancy, "H4");
    assert.match(audit.address, /69 Marine Drive/);
    assert.ok(extract.geometry.some((entity) => entity.kind !== "text"));
  });

  it("reads Hartley occupancy from a plotted PDF sheet", async () => {
    const bytes = loadSample("hartley-test2.pdf");
    const extract = await extractPdf("hartley-test2.pdf", bytes);
    const audit = auditFromDrawing("hartley-test2.pdf", extract);
    assert.equal(audit.occupancy, "G1");
    assert.equal(audit.occupancyNote, "medical offices");
    assert.match(audit.address, /Hartley Road/);
  });

  it("reads wall geometry from the converted woodshed plan PDF", async () => {
    const bytes = loadSample("woodshed-plan.pdf");
    const extract = await extractPdf("woodshed-plan.pdf", bytes);
    assert.ok((extract.entityCounts.POLYLINE ?? 0) > 100);
    assert.ok(extract.strings.length > 20);
  });

  it("plots a DXF and still recovers occupancy after a glyph-split plot", async () => {
    const dxf = readFileSync("public/samples/marine-drive.dxf");
    const extract = extractDrawing(
      "marine-drive.dxf",
      dxf.buffer.slice(dxf.byteOffset, dxf.byteOffset + dxf.byteLength),
    );
    const bytes = await plotDrawingPdf(extract, { splitGlyphs: true });
    const pdf = await extractPdf("marine-drive-plot.pdf", bytes);
    const audit = auditFromDrawing("marine-drive-plot.pdf", pdf);
    assert.equal(audit.occupancy, "H4");
    assert.match(audit.address, /69 Marine Drive/);
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

describe("pdf text reconstruction", () => {
  it("joins neighbouring glyphs and splits far-apart room labels", () => {
    const lines = reconstructPdfLines([
      { str: "O", x: 10, y: 100, width: 7, height: 11, fontSize: 11 },
      { str: "c", x: 17, y: 100, width: 7, height: 11, fontSize: 11 },
      { str: "c", x: 24, y: 100, width: 7, height: 11, fontSize: 11 },
      { str: "H4", x: 40, y: 100, width: 16, height: 11, fontSize: 11 },
      { str: "KITCHEN", x: 200, y: 100, width: 50, height: 11, fontSize: 11 },
      { str: "LOUNGE", x: 10, y: 70, width: 40, height: 11, fontSize: 11 },
    ]);
    assert.deepEqual(
      lines.map((line) => line.value),
      ["Occ H4", "KITCHEN", "LOUNGE"],
    );
  });
});
