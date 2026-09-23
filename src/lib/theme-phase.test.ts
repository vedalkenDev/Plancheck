import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWideSurface, themeDelay } from "./theme-phase";

describe("theme phase", () => {
  it("starts on the right and reaches the left last", () => {
    assert.equal(themeDelay(1000, 1000, 640), 0);
    assert.equal(themeDelay(0, 1000, 640), 640);
    assert.equal(themeDelay(500, 1000, 640), 320);
  });

  it("wipes only surfaces that span most of the screen", () => {
    assert.equal(isWideSurface(1000, 1000), true);
    assert.equal(isWideSurface(720, 1000), true);
    assert.equal(isWideSurface(719, 1000), false);
  });
});
