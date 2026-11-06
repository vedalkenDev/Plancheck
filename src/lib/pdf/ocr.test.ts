import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { linesFromOcr, ocrScale, pageNeedsOcr } from "./ocr";

describe("pdf ocr mapping", () => {
  it("OCRs when the vector layer is empty and skips a notes PDF", () => {
    assert.equal(pageNeedsOcr([]), true);
    assert.equal(
      pageNeedsOcr([
        { value: "Occupancy H4 dwelling", x: 48, y: 400, width: 200, height: 11 },
        { value: "69 Marine Drive", x: 48, y: 380, width: 160, height: 11 },
        { value: "Stairs 170mm riser", x: 48, y: 360, width: 180, height: 11 },
        { value: "Window schedule W1-W19", x: 48, y: 340, width: 200, height: 11 },
        { value: "Site area 3667 m2", x: 48, y: 320, width: 160, height: 11 },
      ]),
      false,
    );
  });

  it("maps tesseract boxes into PDF space for on-sheet measurements", () => {
    const lines = linesFromOcr(
      [
        {
          text: "170mm riser",
          confidence: 88,
          bbox: { x0: 96, y0: 40, x1: 296, y1: 64 },
        },
        {
          text: "noise",
          confidence: 12,
          bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
        },
      ],
      2,
      595,
    );
    assert.equal(lines.length, 1);
    assert.equal(lines[0].value, "170mm riser");
    assert.equal(lines[0].x, 48);
    assert.equal(lines[0].y, 595 - 32);
    assert.equal(lines[0].width, 100);
    assert.equal(lines[0].height, 12);
  });

  it("caps raster scale so an A0 scan does not explode", () => {
    assert.equal(ocrScale(800, 600), 2.5);
    assert.equal(ocrScale(4000, 2800), 0.5);
  });
});
