import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { auditFromDrawing } from "../cad/audit-from-drawing";
import { extractDrawing } from "../cad/extract";
import { geometryBounds } from "../cad/preview";
import { extractPdf, nameSheet, type ExtractProgress } from "./extract";
import {
  marineDriveGlyphPdf,
  marineDriveNotesPdf,
  marineDriveSetPdf,
  measuredWindowNotesPdf,
  windowPaneNotesPdf,
} from "./fixture";
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
    const stairs = audit.passed.find((row) => row.id === "part-m");
    assert.equal(stairs?.detail, "170 mm riser, 250 mm going");

    const stamped = await stampPdf(bytes, audit, extract);
    const annotated = await PDFDocument.load(stamped);
    assert.ok(annotated.getPageCount() >= 1);

    const placed = await extractPdf("marine-drive-notes-stamped.pdf", stamped);
    assert.ok(placed.strings.some((line) => /PLANCHECK/i.test(line)));
    const label = placed.geometry.find(
      (entity) => entity.kind === "text" && /PLANCHECK/i.test(entity.value),
    );
    assert.ok(label && label.kind === "text");
    const onRect =
      label.p.x >= 510 && label.p.x <= 790 && label.p.y >= 70 && label.p.y <= 510;
    assert.equal(onRect, false);

    if (annotated.getPageCount() > 1) {
      const field = annotated.getForm().getTextField("plancheck.fail.xa-fenestration");
      assert.match(field.getText() ?? "", /SANS 204/);
    }
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
    assert.ok(extract.pageWidth && extract.pageWidth > 200);
    assert.ok(extract.pageHeight && extract.pageHeight > 200);
  });

  it("stamps villa notes into empty paper instead of covering the plan", async () => {
    const bytes = loadSample("747-villa.pdf");
    const extract = await extractPdf("747-villa.pdf", bytes);
    const audit = auditFromDrawing("747-villa.pdf", extract);
    const stamped = await stampPdf(bytes, audit, extract);
    const placed = await extractPdf("747-villa-stamped.pdf", stamped);
    assert.ok(placed.strings.some((line) => /PLANCHECK/i.test(line)));
    const label = placed.geometry.find(
      (entity) => entity.kind === "text" && /PLANCHECK/i.test(entity.value),
    );
    assert.ok(label && label.kind === "text");
    const plan = geometryBounds(extract.geometry.filter((entity) => entity.kind !== "text"));
    assert.ok(plan);
    assert.ok(
      label.p.x < plan.minX - 4 ||
        label.p.x > plan.maxX + 4 ||
        label.p.y < plan.minY - 4 ||
        label.p.y > plan.maxY + 4,
      `PLANCHECK at ${label.p.x},${label.p.y} is on the plan ${plan.minX}..${plan.maxX} x ${plan.minY}..${plan.maxY}`,
    );
  });

  it("reads occupancy from a Marine Drive CAD fixture plotted in the test", async () => {
    const dxf = readFileSync("fixtures/cad/marine-drive.dxf");
    const drawing = extractDrawing(
      "marine-drive.dxf",
      dxf.buffer.slice(dxf.byteOffset, dxf.byteOffset + dxf.byteLength),
    );
    const bytes = await plotDrawingPdf(drawing);
    const extract = await extractPdf("marine-drive-plot.pdf", bytes);
    const audit = auditFromDrawing("marine-drive-plot.pdf", extract);
    assert.equal(audit.occupancy, "H4");
    assert.match(audit.address, /69 Marine Drive/);
    assert.ok(extract.geometry.some((entity) => entity.kind !== "text"));
  });

  it("reads Hartley occupancy from a CAD fixture plotted in the test", async () => {
    const dxf = readFileSync("fixtures/cad/hartley-test2.dxf");
    const drawing = extractDrawing(
      "hartley-test2.dxf",
      dxf.buffer.slice(dxf.byteOffset, dxf.byteOffset + dxf.byteLength),
    );
    const bytes = await plotDrawingPdf(drawing);
    const extract = await extractPdf("hartley-plot.pdf", bytes);
    const audit = auditFromDrawing("hartley-plot.pdf", extract);
    assert.equal(audit.occupancy, "G1");
    assert.equal(audit.occupancyNote, "medical offices");
    assert.match(audit.address, /Hartley Road/);
  });

  it("plots a DXF and still recovers occupancy after a glyph-split plot", async () => {
    const dxf = readFileSync("fixtures/cad/marine-drive.dxf");
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

  it("measures glazed area from a plotted window schedule instead of trusting the XA notes", async () => {
    const bytes = await measuredWindowNotesPdf();
    const extract = await extractPdf("measured-windows.pdf", bytes);
    assert.ok(extract.strings.some((line) => /L\/G W1 2000 x 1500 x6/i.test(line)));

    const audit = auditFromDrawing("measured-windows.pdf", extract);
    const xa = audit.failed.find((row) => row.id === "xa-fenestration");
    assert.ok(xa);
    assert.match(xa.detail, /18%/);
    assert.match(xa.detail, /24%/);
    assert.match(xa.detail, /schedule measures/);
    assert.match(xa.adjust, /1 × W1/);
    assert.match(xa.adjust, /3 × W2/);
    const windows = audit.failed.find((row) => row.id === "window-schedule");
    assert.match(windows?.detail ?? "", /pane elevations missing/);
  });

  it("passes Part N when the plotted schedule prints overall and pane sizes", async () => {
    const bytes = await windowPaneNotesPdf();
    const extract = await extractPdf("window-panes.pdf", bytes);
    const audit = auditFromDrawing("window-panes.pdf", extract);
    const windows = audit.passed.find((row) => row.id === "window-schedule");
    assert.match(windows?.detail ?? "", /W1 600 × 1200 mm/);
    assert.match(windows?.detail ?? "", /W2 600 × 1500 mm/);
  });

  it("audits a two-page council set from every sheet, not only the open page", async () => {
    const bytes = await marineDriveSetPdf();
    const extract = await extractPdf("marine-drive-set.pdf", bytes);
    assert.equal(extract.sheets.length, 2);
    assert.match(extract.sheets[0].name, /Proposed additions/i);
    assert.match(extract.sheets[1].name, /Window schedule/i);
    assert.ok(extract.sheets[0].strings.some((line) => /Occupancy H4 dwelling/i.test(line)));
    assert.equal(
      extract.sheets[0].strings.some((line) => /Window schedule/i.test(line)),
      false,
    );
    assert.ok(extract.sheets[1].strings.some((line) => /Window schedule/i.test(line)));
    assert.equal(
      extract.sheets[1].strings.some((line) => /Occupancy H4 dwelling/i.test(line)),
      false,
    );

    const fromOpenSheet = auditFromDrawing("marine-drive-set.pdf", {
      ...extract,
      texts: extract.sheets[0].texts,
      strings: extract.sheets[0].strings,
    });
    assert.equal(fromOpenSheet.occupancy, "H4");
    assert.equal(
      fromOpenSheet.passed.some((row) => row.id === "window-schedule"),
      false,
    );
    assert.equal(
      fromOpenSheet.passed.some((row) => row.id === "part-m"),
      false,
    );

    const audit = auditFromDrawing("marine-drive-set.pdf", extract);
    assert.equal(audit.occupancy, "H4");
    assert.match(audit.address, /69 Marine Drive/);
    assert.ok(audit.passed.some((row) => row.id === "window-schedule"));
    const stairs = audit.passed.find((row) => row.id === "part-m");
    assert.equal(stairs?.detail, "170 mm riser, 250 mm going");
    const xa = audit.failed.find((row) => row.id === "xa-fenestration");
    assert.ok(xa);
    assert.match(xa.detail, /16\.9%/);

    const stamped = await stampPdf(bytes, audit, extract);
    const annotated = await PDFDocument.load(stamped);
    assert.ok(annotated.getPageCount() >= 2);
  });

  it("reports extract progress once per sheet", async () => {
    const bytes = await marineDriveSetPdf();
    const seen: ExtractProgress[] = [];
    await extractPdf("marine-drive-set.pdf", bytes, {
      onProgress: (info) => seen.push({ ...info }),
    });
    assert.ok(seen.some((info) => info.page === 0));
    assert.ok(seen.some((info) => info.page === 1 && info.total === 2));
    assert.equal(seen.at(-1)?.page, 2);
    assert.equal(seen.at(-1)?.total, 2);
    assert.ok((seen[0]?.startedAt ?? 0) > 0);
    assert.ok(seen.every((info) => info.startedAt === seen[0]?.startedAt));
  });

  it("caps path entities so a CAD plot cannot explode the extract", async () => {
    const bytes = loadSample("747-villa.pdf");
    const extract = await extractPdf("747-villa.pdf", bytes, { maxEntities: 3 });
    const strokes = extract.sheets[0].geometry.filter((entity) => entity.kind !== "text");
    assert.ok(strokes.length <= 3);
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

describe("sheet names", () => {
  it("names a sheet from the first title-like line", () => {
    assert.equal(
      nameSheet(["Occupancy H4 dwelling", "Proposed additions and alterations"], 0),
      "Sheet 1 · Proposed additions and alterations",
    );
    assert.equal(nameSheet(["Erf 672", "Window schedule W1-W19"], 1), "Sheet 2 · Window schedule W1-W19");
    assert.equal(nameSheet(["Erf 672"], 0), "Sheet 1");
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
