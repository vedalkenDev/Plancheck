import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampZoom, fitCamera, panCamera, zoomCamera } from "./camera";

const frame = { minX: 0, minY: 0, maxX: 100, maxY: 50 };

describe("drawing camera", () => {
  it("fits the sheet inside the view", () => {
    const camera = fitCamera(frame, 200, 200, 0);
    assert.equal(camera.width, 100);
    assert.equal(camera.height, 100);
    assert.equal(camera.x, 0);
    assert.ok(camera.y < 0);
    assert.ok(camera.y + camera.height > 50);
  });

  it("moves the sheet with the pointer", () => {
    const camera = { x: 0, y: 0, width: 100, height: 100 };
    const next = panCamera(camera, 20, -10, 200, 200);
    assert.equal(next.x, -10);
    assert.equal(next.y, 5);
  });

  it("zooms toward the pointer", () => {
    const camera = { x: 0, y: 0, width: 100, height: 100 };
    const next = zoomCamera(camera, 2, 0, 0, 200, 200);
    assert.equal(next.x, 0);
    assert.equal(next.y, 0);
    assert.equal(next.width, 50);
    assert.equal(next.height, 50);

    const center = zoomCamera(camera, 2, 100, 100, 200, 200);
    assert.equal(center.x, 25);
    assert.equal(center.y, 25);
  });

  it("refuses a zoom that loses the sheet", () => {
    const camera = fitCamera(frame, 200, 200, 0);
    const tooFar = zoomCamera(camera, 0.001, 100, 100, 200, 200);
    assert.equal(clampZoom(camera, frame, tooFar), camera);
  });
});
