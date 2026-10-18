import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PERIOD, TRAVEL_MM, X_MAX, X_MIN, clockAt, mmAt, readoutOf, xOf } from "./model";

describe("scan travel", () => {
  it("maps the window onto the rail", () => {
    assert.equal(xOf(0), X_MIN);
    assert.equal(xOf(TRAVEL_MM), X_MAX);
    assert.equal(xOf(TRAVEL_MM / 2), (X_MIN + X_MAX) / 2);
    assert.equal(xOf(-10), X_MIN);
    assert.equal(xOf(999), X_MAX);
  });

  it("reads millimetres from the head", () => {
    assert.equal(readoutOf(0), "scan 0.0 mm");
    assert.equal(readoutOf(240), "scan 240.0 mm");
    assert.equal(readoutOf(12.44), "scan 12.4 mm");
  });

  it("sweeps out and back, and can resume from the same millimetre", () => {
    assert.equal(mmAt(0), 0);
    assert.ok(Math.abs(mmAt(PERIOD / 2) - TRAVEL_MM) < 1e-9);
    assert.ok(Math.abs(mmAt(PERIOD)) < 1e-9);
    for (const clock of [0.2, 1.1, 2.4, 3.7, 4.6]) {
      const mm = mmAt(clock);
      const direction = mmAt(clock + 0.02) >= mm ? 1 : -1;
      const resumed = clockAt(mm, direction);
      assert.ok(Math.abs(mmAt(resumed) - mm) < 1e-6, `${clock} resumed ${resumed}`);
    }
  });
});
