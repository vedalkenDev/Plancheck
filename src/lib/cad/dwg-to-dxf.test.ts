import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dwgToDxf } from "./dwg-to-dxf";
import { extractDrawing } from "./extract";

function arrayBuffer(bytes: Buffer) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe("dwg conversion", () => {
  it("converts a DWG into DXF the drawing reader can use", async () => {
    const dwg = readFileSync("src/lib/cad/fixtures/sample_2018.dwg");
    const dxf = await dwgToDxf(arrayBuffer(dwg));
    assert.ok(dxf);
    assert.match(dxf, /ENTITIES/);

    const encoded = Buffer.from(dxf);
    const extract = extractDrawing("sample.dxf", arrayBuffer(encoded));
    assert.equal(extract.format, "dxf");
    assert.ok(extract.strings.some((line) => /teksto simpla/i.test(line)));
    assert.ok(extract.geometry.some((entity) => entity.kind === "line"));
    assert.ok(extract.geometry.some((entity) => entity.kind === "circle"));
    assert.ok(extract.geometry.some((entity) => entity.kind === "text"));
  });
});
