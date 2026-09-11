import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { auditFromDrawing } from "./audit-from-drawing";
import { extractDrawing } from "./extract";

function load(path: string, name: string) {
  const bytes = readFileSync(path);
  const extract = extractDrawing(name, bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ));
  return { extract, audit: auditFromDrawing(name, extract) };
}

describe("marine-drive fixture", () => {
  const { extract, audit } = load(
    "public/samples/marine-drive.dxf",
    "marine-drive.dxf",
  );

  it("reads geometry and occupancy", () => {
    assert.equal(extract.format, "dxf");
    assert.ok(extract.geometry.some((entity) => entity.kind === "polyline"));
    assert.equal(audit.occupancy, "H4");
    assert.match(audit.address, /69 Marine Drive/);
  });

  it("fails XA, pool, signatures, and engineering", () => {
    const failed = audit.failed.map((row) => row.id).sort();
    assert.ok(failed.includes("xa-fenestration"));
    assert.ok(failed.includes("part-d"));
    assert.ok(failed.includes("signatures"));
    assert.ok(failed.includes("eng-packs"));
  });

  it("passes parking, coverage, stairs, and stormwater", () => {
    const passed = audit.passed.map((row) => row.id);
    assert.ok(passed.includes("parking"));
    assert.ok(passed.includes("coverage"));
    assert.ok(passed.includes("part-m"));
    assert.ok(passed.includes("part-r"));
    assert.ok(passed.includes("site-area"));
  });
});

describe("hartley-test2 fixture", () => {
  const { audit } = load(
    "public/samples/hartley-test2.dxf",
    "hartley-test2.dxf",
  );

  it("flags address conflict and leftover title", () => {
    const failed = audit.failed.map((row) => row.id);
    assert.ok(failed.includes("address"));
    assert.ok(failed.includes("titleblocks"));
    assert.ok(failed.includes("xa-fenestration"));
    assert.ok(failed.includes("part-r"));
    assert.ok(failed.includes("part-m"));
    assert.ok(failed.includes("part-s"));
    assert.ok(failed.includes("part-t"));
  });

  it("classifies G1 medical offices", () => {
    assert.equal(audit.occupancy, "G1");
    assert.equal(audit.occupancyNote, "medical offices");
  });
});
