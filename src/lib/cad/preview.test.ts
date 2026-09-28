import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GeomEntity } from "./extract";
import { geometryBounds, wrapText } from "./preview";

describe("wrapped notes", () => {
  it("breaks a paragraph on the column and keeps a new paragraph", () => {
    const lines = wrapText("All glazing to comply with SANS 10400 part N on this sheet.\nSecond note", 20, 2);
    assert.ok(lines.length > 2);
    assert.ok(lines.every((line) => line.length <= 18));
    assert.equal(lines.at(-1), "Second note");
    assert.equal(wrapText("Short label", undefined, 2).join("\n"), "Short label");
  });
});

describe("drawing frame", () => {
  it("fits the plan and ignores a stray point far from the sheet", () => {
    const plan: GeomEntity[] = [];
    for (let i = 0; i < 12; i += 1) {
      plan.push({
        kind: "line",
        a: { x: 1000 + i * 100, y: 2000 },
        b: { x: 1000 + i * 100, y: 4000 },
      });
    }
    plan.push({
      kind: "line",
      a: { x: 0, y: 0 },
      b: { x: 5_000_000, y: 8_000_000 },
    });
    plan.push({
      kind: "circle",
      c: { x: 1500, y: 3000 },
      r: 9_000_000,
    });

    const bounds = geometryBounds(plan);
    assert.ok(bounds);
    assert.ok(bounds.minX >= 900);
    assert.ok(bounds.maxX <= 2300);
    assert.ok(bounds.minY >= 1900);
    assert.ok(bounds.maxY <= 4200);
  });
});
