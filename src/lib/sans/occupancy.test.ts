import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditFromDrawing } from "../cad/audit-from-drawing";
import type { DrawingExtract } from "../cad/extract";
import { needsFirePartT } from "./occupancy";

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

const BASE_G1 = [
  "Occupancy G1 medical offices",
  "12 Office Road",
  "Soakpit stormwater Part R",
  "Stairs 170mm riser 250mm going Part M",
];

describe("needsFirePartT", () => {
  it("requires fire notes on public, commercial, hotel, and storage occupancies", () => {
    for (const code of ["A1", "B2", "C1", "E2", "F1", "G1", "H1", "J1"]) {
      assert.equal(needsFirePartT(code), true, code);
    }
  });

  it("does not require a fire-notes block on dwellings", () => {
    for (const code of ["H3", "H4", "H5", "D2", "—"]) {
      assert.equal(needsFirePartT(code), false, code);
    }
  });
});

describe("part T fire notes", () => {
  it("fails G1 when fire protection notes are missing", () => {
    const audit = auditFromDrawing("offices.pdf", extractFrom(BASE_G1));
    const fire = audit.failed.find((row) => row.id === "part-t");
    assert.equal(fire?.detail, "Part T fire notes not found");
    assert.match(fire?.adjust ?? "", /Part T fire protection/);
  });

  it("passes G1 when fire protection notes are on the sheet", () => {
    const audit = auditFromDrawing(
      "offices-fire.pdf",
      extractFrom([...BASE_G1, "FIRE PROTECTION NOTES hose reel"]),
    );
    const fire = audit.passed.find((row) => row.id === "part-t");
    assert.equal(fire?.detail, "Fire notes found");
  });

  it("fails G1 after fireprotection notes are stripped (one-word label)", () => {
    const withNotes = auditFromDrawing(
      "offices-fire.pdf",
      extractFrom([...BASE_G1, "fireprotection notes"]),
    );
    const stripped = auditFromDrawing("offices.pdf", extractFrom(BASE_G1));
    assert.ok(withNotes.passed.some((row) => row.id === "part-t"));
    assert.ok(stripped.failed.some((row) => row.id === "part-t"));
    assert.ok(!stripped.passed.some((row) => row.id === "part-t"));
  });

  it("skips H4 dwellings that have no fire notes", () => {
    const audit = auditFromDrawing(
      "house.pdf",
      extractFrom([
        "Occupancy H4 dwelling",
        "69 Marine Drive",
        "Soakpit stormwater Part R",
        "Stairs 170mm riser 250mm going Part M",
      ]),
    );
    assert.ok(!audit.failed.some((row) => row.id === "part-t"));
    assert.ok(!audit.passed.some((row) => row.id === "part-t"));
  });

  it("still records fire notes when an H4 drawing includes them", () => {
    const audit = auditFromDrawing(
      "house-fire.pdf",
      extractFrom([
        "Occupancy H4 dwelling",
        "69 Marine Drive",
        "Part T fire escape and hose reel",
      ]),
    );
    const fire = audit.passed.find((row) => row.id === "part-t");
    assert.equal(fire?.detail, "Fire notes found");
  });
});
