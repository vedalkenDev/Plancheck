import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditFromDrawing } from "../cad/audit-from-drawing";
import type { DrawingExtract, GeomEntity } from "../cad/extract";
import { thinFloorplanPdf } from "../pdf/fixture";
import { extractPdf } from "../pdf/extract";
import {
  collectDims,
  expandRepeatedDigits,
  plottedMm,
  readScale,
  readSheet,
} from "./sheet";

function extractFrom(
  lines: string[],
  geometry: GeomEntity[] = [],
): DrawingExtract {
  const texts = lines.map((value, index) => ({
    kind: "text" as const,
    value,
    x: 10,
    y: 400 - index * 16,
  }));
  const geom: GeomEntity[] =
    geometry.length > 0
      ? geometry
      : texts.map((item) => ({
          kind: "text" as const,
          p: { x: item.x ?? 0, y: item.y ?? 0 },
          height: 12,
          value: item.value,
        }));
  return {
    format: "pdf",
    texts,
    strings: lines,
    entityCounts: { TEXT: lines.length },
    geometry: geom,
    sheets: [
      {
        name: "Sheet 1",
        geometry: geom,
        texts,
        strings: lines,
      },
    ],
    pageWidth: 1190,
    pageHeight: 842,
  };
}

describe("sheet scale and dimension strings", () => {
  it("reads a titleblock 1:100 scale", () => {
    const scale = readScale(["Occupancy H4 dwelling", "SCALE 1:100", "SIZE A3"]);
    assert.equal(scale?.ratio, 100);
  });

  it("splits concatenated CAD dimension runs", () => {
    assert.equal(expandRepeatedDigits("190319031903 23952395"), "1903 1903 1903 2395 2395");
    assert.equal(expandRepeatedDigits("438438"), "438 438");
  });

  it("reads millimetre pairs sitting on the plan, not in a notes sentence", () => {
    const dims = collectDims([
      { value: "W1", x: 40, y: 80, height: 10, width: 16 },
      { value: "1800 x 1200", x: 70, y: 80, height: 10, width: 70 },
      { value: "BED ROOM", x: 200, y: 180, height: 10, width: 60 },
    ]);
    assert.equal(dims.some((dim) => dim.mm === 1800 && dim.pairMm === 1200), true);
  });

  it("converts plotted PDF lengths with a 1:100 titleblock scale", () => {
    const goingPt = (250 * 72) / 25.4 / 100;
    assert.equal(plottedMm(goingPt, { ratio: 100, quote: "SCALE 1:100" }), 250);
    assert.equal(plottedMm(goingPt, { ratio: 1, quote: "SCALE 1:1" }), undefined);
  });
});

describe("Check reads on-sheet millimetres", () => {
  it("measures riser and going from dimension text next to the stair", () => {
    const extract = extractFrom([
      "BED ROOM",
      "KITCHEN",
      "170",
      "RISER",
      "250",
      "GOING",
      "SCALE 1:100",
      "Occupancy H4 dwelling",
      "12 Thin Road",
    ]);
    const sheet = readSheet(extract);
    assert.equal(sheet.stairs.riserMm, 170);
    assert.equal(sheet.stairs.goingMm, 250);
    assert.equal(sheet.stairs.source, "dimension");

    const audit = auditFromDrawing("thin.pdf", extract);
    const stairs = audit.passed.find((row) => row.id === "part-m");
    assert.equal(stairs?.detail, "170 mm riser, 250 mm going");
    assert.equal(stairs?.how, "measured");
  });

  it("measures a window from W1 plus a nearby overall size", () => {
    const extract = extractFrom([
      "BED ROOM",
      "W1",
      "Ground 1800 x 1200",
      "KITCHEN",
      "SCALE 1:100",
      "Occupancy H4 dwelling",
      "Ground nett floor 48 m2",
      "12 Thin Road",
    ]);
    const sheet = readSheet(extract);
    assert.equal(sheet.windows.length, 1);
    assert.equal(sheet.windows[0].type, "W1");
    assert.equal(sheet.windows[0].widthM, 1.8);
    assert.equal(sheet.windows[0].heightM, 1.2);

    const audit = auditFromDrawing("thin-window.pdf", extract);
    const windows = audit.failed.find((row) => row.id === "window-schedule")
      ?? audit.passed.find((row) => row.id === "window-schedule");
    assert.equal(windows?.how, "measured");
    const xa = audit.failed.find((row) => row.id === "xa-fenestration")
      ?? audit.passed.find((row) => row.id === "xa-fenestration");
    assert.equal(xa?.how, "measured");
  });

  it("keeps Marine Drive notes millimetres as measured stairs and parsed site area", () => {
    const audit = auditFromDrawing(
      "marine-drive-notes.pdf",
      extractFrom([
        "Proposed additions and alterations to existing dwelling",
        "69 Marine Drive House Khan",
        "Occupancy H4 dwelling",
        "Site area 3667 m2",
        "Coverage under limit",
        "Parking 6 / 6",
        "Stairs 170mm riser 250mm going Part M",
        "Lighting under 5 W/m2",
      ]),
    );
    assert.equal(audit.passed.find((row) => row.id === "part-m")?.how, "measured");
    assert.equal(audit.passed.find((row) => row.id === "site-area")?.how, "measured");
    assert.equal(audit.passed.find((row) => row.id === "parking")?.how, "measured");
    assert.equal(audit.passed.find((row) => row.id === "part-o")?.how, "measured");
    assert.equal(audit.passed.find((row) => row.id === "coverage")?.how, "notes");
  });

  it("reads the thin floor-plan PDF from geometry and titleblock scale", async () => {
    const bytes = await thinFloorplanPdf();
    const extract = await extractPdf("thin-floorplan.pdf", bytes);
    const sheet = readSheet(extract);
    assert.equal(sheet.scale?.ratio, 100);
    assert.equal(sheet.stairs.riserMm, 170);
    assert.equal(sheet.stairs.goingMm, 250);
    assert.ok(sheet.windows.some((unit) => unit.type === "W1" && unit.widthM === 1.8));

    const audit = auditFromDrawing("thin-floorplan.pdf", extract);
    const stairs = audit.passed.find((row) => row.id === "part-m");
    assert.equal(stairs?.detail, "170 mm riser, 250 mm going");
    assert.equal(stairs?.how, "measured");
    const windows = audit.passed.find((row) => row.id === "window-schedule");
    assert.equal(windows?.how, "measured");
    assert.match(windows?.detail ?? "", /900 × 1200 mm/);
    const xa = audit.passed.find((row) => row.id === "xa-fenestration");
    assert.equal(xa?.how, "measured");
    assert.match(xa?.detail ?? "", /4\.5%/);
  });
});
