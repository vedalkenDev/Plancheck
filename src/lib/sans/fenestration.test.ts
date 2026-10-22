import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditFromDrawing } from "../cad/audit-from-drawing";
import type { DrawingExtract } from "../cad/extract";
import {
  parseWindowUnits,
  readFenestration,
  suggestGlazingCuts,
} from "./fenestration";

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

describe("parseWindowUnits", () => {
  it("reads millimetre overall sizes, quantities, and storeys", () => {
    const units = parseWindowUnits(
      ["L/G W1 2000 x 1500 x6", "Ground W2 1800x1200 (4)"].join("\n"),
    );
    assert.equal(units.length, 2);
    assert.deepEqual(
      units.map((unit) => ({
        type: unit.type,
        storey: unit.storey,
        widthM: unit.widthM,
        heightM: unit.heightM,
        qty: unit.qty,
      })),
      [
        { type: "W1", storey: "L/G", widthM: 2, heightM: 1.5, qty: 6 },
        { type: "W2", storey: "Ground", widthM: 1.8, heightM: 1.2, qty: 4 },
      ],
    );
  });

  it("reads metre sizes and a type on the previous line", () => {
    const units = parseWindowUnits(["W3", "1.8 m x 1.2 m 2 off"].join("\n"));
    assert.equal(units.length, 1);
    assert.equal(units[0].type, "W3");
    assert.equal(units[0].widthM, 1.8);
    assert.equal(units[0].heightM, 1.2);
    assert.equal(units[0].qty, 2);
  });

  it("does not treat Marine Drive notes as window sizes", () => {
    const units = parseWindowUnits(
      [
        "Fenestration L/G 16.9% Ground 17.1%",
        "L/G nett floor 371 m2",
        "Ground nett floor 367 m2",
        "Window schedule W1-W19 unit sizes drawn",
        "Stairs 170mm riser 250mm going Part M",
        "Lighting under 5 W/m2",
      ].join("\n"),
    );
    assert.equal(units.length, 0);
  });
});

describe("readFenestration", () => {
  it("measures glazed area and percent from the schedule, not the printed XA figure", () => {
    const reading = readFenestration(
      [
        "Fenestration L/G 10% Ground 10%",
        "L/G nett floor 100 m2",
        "Ground nett floor 100 m2",
        "L/G W1 2000 x 1500 x6",
        "Ground W2 2000 x 1500 x8",
      ].join("\n"),
    );
    assert.equal(reading.measured, true);
    assert.equal(reading.glazedM2, 42);
    const lg = reading.storeys.find((row) => row.storey === "L/G");
    const ground = reading.storeys.find((row) => row.storey === "Ground");
    assert.equal(lg?.printedPercent, 10);
    assert.equal(lg?.measuredPercent, 18);
    assert.equal(lg?.glazedM2, 18);
    assert.equal(ground?.printedPercent, 10);
    assert.equal(ground?.measuredPercent, 24);
    assert.match(suggestGlazingCuts(lg!, reading.units), /1 × W1/);
    assert.match(suggestGlazingCuts(ground!, reading.units), /3 × W2/);
  });
});

describe("audit uses measured fenestration", () => {
  it("fails XA on the schedule measurement when the titleblock is wrong", () => {
    const audit = auditFromDrawing(
      "measured.pdf",
      extractFrom([
        "Proposed dwelling",
        "12 Test Road",
        "Occupancy H4 dwelling",
        "Fenestration L/G 10% Ground 10%",
        "L/G nett floor 100 m2",
        "Ground nett floor 100 m2",
        "Window schedule",
        "L/G W1 2000 x 1500 x6",
        "Ground W2 2000 x 1500 x8",
      ]),
    );
    const xa = audit.failed.find((row) => row.id === "xa-fenestration");
    assert.ok(xa);
    assert.match(xa.detail, /18%/);
    assert.match(xa.detail, /24%/);
    assert.match(xa.detail, /10%/);
    assert.match(xa.detail, /schedule measures/);
    assert.match(xa.adjust, /1 × W1/);
    assert.match(xa.adjust, /3 × W2/);
    const windows = audit.passed.find((row) => row.id === "window-schedule");
    assert.match(windows?.detail ?? "", /42\.00 m² glazed measured/);
  });

  it("keeps Marine Drive XA numbers when the schedule has no sizes", () => {
    const audit = auditFromDrawing(
      "marine-drive-notes.pdf",
      extractFrom([
        "Occupancy H4 dwelling",
        "69 Marine Drive House Khan",
        "Fenestration L/G 16.9% Ground 17.1%",
        "L/G nett floor 371 m2",
        "Ground nett floor 367 m2",
        "Window schedule W1-W19 unit sizes drawn",
        "XA not required",
      ]),
    );
    const xa = audit.failed.find((row) => row.id === "xa-fenestration");
    assert.ok(xa);
    assert.match(xa.detail, /16\.9%/);
    assert.match(xa.detail, /17\.1%/);
    assert.doesNotMatch(xa.detail, /Measured from the window schedule/);
    assert.match(xa.adjust, /7\.05 m²/);
    assert.match(xa.adjust, /7\.71 m²/);
    assert.match(audit.warnings?.join(" ") ?? "", /not measured from window sizes/);
  });
});
