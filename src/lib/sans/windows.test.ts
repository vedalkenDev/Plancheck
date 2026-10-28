import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditFromDrawing } from "../cad/audit-from-drawing";
import type { DrawingExtract } from "../cad/extract";
import { MARINE_DRIVE_NOTES, MEASURED_WINDOW_NOTES, WINDOW_PANE_NOTES } from "../pdf/fixture";
import { parsePanes, readWindowSchedule } from "./windows";

function extractFrom(lines: string[]): DrawingExtract {
  const texts = lines.map((value) => ({ kind: "text" as const, value }));
  return {
    format: "pdf",
    texts,
    strings: lines,
    entityCounts: { TEXT: lines.length },
    geometry: [],
    sheets: [
      {
        name: "Sheet 1",
        geometry: [],
        texts,
        strings: lines,
      },
    ],
  };
}

describe("parsePanes", () => {
  it("reads sizes after pane, fixed, and openable — not the overall unit", () => {
    const panes = parsePanes(
      [
        "W1 1800 x 1200 panes 600 x 1200, 1200 x 1200",
        "W2 2000 x 1500",
        "fixed 600 x 1500 openable 1400 x 1500",
      ].join("\n"),
    );
    assert.deepEqual(
      panes.map((pane) => ({
        type: pane.type,
        widthM: pane.widthM,
        heightM: pane.heightM,
      })),
      [
        { type: "W1", widthM: 0.6, heightM: 1.2 },
        { type: "W1", widthM: 1.2, heightM: 1.2 },
        { type: "W2", widthM: 0.6, heightM: 1.5 },
        { type: "W2", widthM: 1.4, heightM: 1.5 },
      ],
    );
  });

  it("does not treat overall millimetre sizes as panes", () => {
    const panes = parsePanes(["L/G W1 2000 x 1500 x6", "Ground W2 2000 x 1500 x8"].join("\n"));
    assert.equal(panes.length, 0);
  });

  it("does not treat Marine Drive notes or lighting as panes", () => {
    const panes = parsePanes(
      [
        "Window schedule W1-W19 unit sizes drawn",
        "Stairs 170mm riser 250mm going Part M",
        "Lighting under 5 W/m2",
      ].join("\n"),
    );
    assert.equal(panes.length, 0);
  });
});

describe("audit uses measured pane elevations", () => {
  it("passes Part N when overall and each pane are printed", () => {
    const audit = auditFromDrawing("panes.pdf", extractFrom(WINDOW_PANE_NOTES));
    const windows = audit.passed.find((row) => row.id === "window-schedule");
    assert.match(windows?.detail ?? "", /W1 600 × 1200 mm \+ 1200 × 1200 mm/);
    assert.match(windows?.detail ?? "", /W2 600 × 1500 mm \+ 1400 × 1500 mm/);
    assert.equal(windows?.how, "measured");
    assert.equal(windows?.clause, "SANS 10400-N / A7");
    const xa = audit.passed.find((row) => row.id === "xa-fenestration");
    assert.match(xa?.detail ?? "", /7\.3%/);
  });

  it("fails Part N when overall sizes are drawn without panes", () => {
    const audit = auditFromDrawing("measured.pdf", extractFrom(MEASURED_WINDOW_NOTES));
    const windows = audit.failed.find((row) => row.id === "window-schedule");
    assert.match(windows?.detail ?? "", /W1–W2 overall sizes drawn, pane elevations missing/);
    assert.equal(windows?.how, "measured");
    assert.match(windows?.adjust ?? "", /pane width/);
    const xa = audit.failed.find((row) => row.id === "xa-fenestration");
    assert.ok(xa);
  });

  it("keeps Marine Drive as unit sizes drawn when millimetres are not printed", () => {
    const audit = auditFromDrawing("marine-drive-notes.pdf", extractFrom(MARINE_DRIVE_NOTES));
    const windows = audit.passed.find((row) => row.id === "window-schedule");
    assert.equal(windows?.detail, "W1–W19 with unit sizes drawn");
    assert.equal(windows?.how, "notes");
    assert.equal(readWindowSchedule(MARINE_DRIVE_NOTES.join("\n")).panes.length, 0);
  });

  it("keeps Hartley Present when the schedule has no window types", () => {
    const audit = auditFromDrawing(
      "hartley.pdf",
      extractFrom(["Occupancy G1 medical offices", "130 Hartley Road", "Window schedule"]),
    );
    const windows = audit.passed.find((row) => row.id === "window-schedule");
    assert.equal(windows?.detail, "Present");
  });
});
