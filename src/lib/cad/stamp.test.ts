import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditSample } from "@/data/types";
import type { DrawingExtract, GeomEntity, Point } from "./extract";
import { stampAudit } from "./stamp";

const audit: AuditSample = {
  id: "sheet",
  slug: "sheet",
  label: "Sheet",
  fileStem: "sheet",
  project: "Sheet",
  erf: null,
  address: "",
  occupancy: "H4",
  occupancyNote: "dwelling",
  verdict: "Close, not council-ready.",
  passed: [],
  failed: [
    {
      id: "part-d",
      part: "D",
      check: "Pool enclosure",
      detail: "Missing",
      status: "fail",
      adjust: "Fence the pool at 1.2 m.",
    },
  ],
};

function sheet(inkOnLeft: boolean): DrawingExtract {
  const border: Point[] = [];
  for (let x = 0; x <= 1000; x += 40) {
    border.push({ x, y: 0 }, { x, y: 700 });
  }
  for (let y = 0; y <= 700; y += 40) {
    border.push({ x: 0, y }, { x: 1000, y });
  }
  const geometry: GeomEntity[] = [
    { kind: "polyline", closed: true, points: border },
    { kind: "text", p: { x: 40, y: 40 }, height: 5, value: "Room" },
  ];
  if (inkOnLeft) {
    for (let x = 20; x <= 400; x += 15) {
      geometry.push({
        kind: "line",
        a: { x, y: 20 },
        b: { x, y: 680 },
      });
    }
  }
  return {
    format: "dxf",
    texts: [],
    strings: [],
    entityCounts: {},
    geometry,
    sheets: [{ name: "Sheet 1", geometry, texts: [], strings: [] }],
  };
}

describe("stampAudit", () => {
  it("uses the drawing text height and stays inside the sheet", () => {
    const stamped = stampAudit(sheet(false), audit);
    const notes = stamped.geometry.flatMap((entity) =>
      entity.kind === "text" && entity.layer === "COUNCIL_CHECK" ? [entity] : [],
    );
    assert.ok(notes.length >= 1);
    assert.equal(notes[0].value, audit.verdict);
    for (const note of notes) {
      assert.equal(note.height, 5);
      assert.ok(note.p.x >= 0 && note.p.x <= 1000);
      assert.ok(note.p.y >= 0 && note.p.y <= 700);
    }
    const fixes = stamped.geometry.flatMap((entity) =>
      entity.kind === "text" && entity.layer === "COUNCIL_FIXES" ? [entity] : [],
    );
    assert.ok(fixes.some((entity) => entity.value.includes("SANS D")));
  });

  it("parks the stamp in the open side of the sheet", () => {
    const stamped = stampAudit(sheet(true), audit);
    const verdict = stamped.geometry.flatMap((entity) =>
      entity.kind === "text" && entity.value === audit.verdict ? [entity] : [],
    )[0];
    assert.ok(verdict);
    assert.ok(verdict.p.x > 400);
  });

  it("replaces an earlier stamp instead of stacking one", () => {
    const once = stampAudit(sheet(false), audit);
    const twice = stampAudit(once, audit);
    const frames = twice.geometry.filter(
      (entity) => entity.kind === "polyline" && entity.layer === "COUNCIL_CHECK",
    );
    assert.equal(frames.length, 1);
  });
});
