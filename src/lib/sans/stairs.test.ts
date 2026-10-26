import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditFromDrawing } from "../cad/audit-from-drawing";
import type { DrawingExtract } from "../cad/extract";
import { MAX_RISER_MM, MIN_GOING_MM, readStairs } from "./stairs";

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

describe("readStairs", () => {
  it("reads millimetre riser and going from a Part M note", () => {
    assert.deepEqual(readStairs("Stairs 170mm riser 250mm going Part M"), {
      riserMm: 170,
      goingMm: 250,
    });
  });

  it("reads labelled sizes written the other way around, including metres", () => {
    assert.deepEqual(readStairs("riser 0.18 m going 0.26 m"), {
      riserMm: 180,
      goingMm: 260,
    });
  });

  it("does not treat site area or lighting as stair dimensions", () => {
    const reading = readStairs("Stairs\nSite area 3667 m2\nLighting under 5 W/m2");
    assert.equal(reading.riserMm, undefined);
    assert.equal(reading.goingMm, undefined);
  });
});

describe("audit uses measured stairs", () => {
  it("passes Marine Drive notes with the printed riser and going", () => {
    const audit = auditFromDrawing(
      "stairs.pdf",
      extractFrom([
        "Occupancy H4 dwelling",
        "69 Marine Drive",
        "Stairs 170mm riser 250mm going Part M",
      ]),
    );
    const stairs = audit.passed.find((row) => row.id === "part-m");
    assert.equal(stairs?.detail, "170 mm riser, 250 mm going");
  });

  it("fails Hartley-style stairs that name the flight without dimensions", () => {
    const audit = auditFromDrawing(
      "hartley-stairs.pdf",
      extractFrom(["Occupancy G1 medical offices", "130 Hartley Road", "Stairs"]),
    );
    const stairs = audit.failed.find((row) => row.id === "part-m");
    assert.equal(stairs?.detail, "Stair dims missing");
    assert.match(stairs?.adjust ?? "", /riser/);
    assert.match(stairs?.adjust ?? "", /going/);
  });

  it("fails a steep riser with a millimetre cut", () => {
    const audit = auditFromDrawing(
      "steep.pdf",
      extractFrom(["Stairs", `riser 220 mm going ${MIN_GOING_MM} mm`]),
    );
    const stairs = audit.failed.find((row) => row.id === "part-m");
    assert.ok(stairs);
    assert.match(stairs.detail, /220 mm riser/);
    assert.match(stairs.adjust, new RegExp(`220 mm to ${MAX_RISER_MM} mm`));
  });
});
