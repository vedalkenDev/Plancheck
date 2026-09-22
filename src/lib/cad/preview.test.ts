import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GeomEntity } from "./extract";
import { geometryBounds } from "./preview";

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
