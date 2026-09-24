import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { addVisibleText, buildAnnotatedDrawing } from "./annotate";
import { auditFromDrawing } from "./audit-from-drawing";
import { extractDrawing } from "./extract";
import { geometryBounds } from "./preview";
import { stampAudit } from "./stamp";
import { occupancyFromText } from "../sans/occupancy";

function load(path: string, name: string) {
  const bytes = readFileSync(path);
  const extract = extractDrawing(
    name,
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return {
    text: bytes.toString("utf8"),
    extract,
    audit: auditFromDrawing(name, extract),
  };
}

describe("occupancy from drawing", () => {
  it("does not treat regulation A20 as an occupancy class", () => {
    assert.equal(occupancyFromText("Form 1 Regulation A20").code, "—");
  });

  it("reads H4 dwelling and G1 medical offices from labels", () => {
    assert.equal(occupancyFromText("Occupancy H4 dwelling").code, "H4");
    assert.equal(occupancyFromText("Occupancy H4 dwelling").note, "dwelling");
    assert.equal(
      occupancyFromText("Occupancy G1 medical offices").note,
      "medical offices",
    );
  });
});

describe("marine-drive fixture", () => {
  const { extract, audit, text } = load(
    "public/samples/marine-drive.dxf",
    "marine-drive.dxf",
  );

  it("reads H4 dwelling from the drawing, not A20", () => {
    assert.equal(extract.format, "dxf");
    assert.equal(audit.occupancy, "H4");
    assert.equal(audit.occupancyNote, "dwelling");
    assert.match(audit.address, /69 Marine Drive/);
    assert.ok(!audit.passed.some((row) => row.detail.includes("A20")));
  });

  it("fails XA with 15% rule and numeric glazing cuts", () => {
    const xa = audit.failed.find((row) => row.id === "xa-fenestration");
    assert.ok(xa);
    assert.match(xa.detail, /16\.9%/);
    assert.match(xa.detail, /17\.1%/);
    assert.match(xa.adjust, /7\.05 m²/);
    assert.match(xa.adjust, /7\.71 m²/);
    assert.match(xa.adjust, /SANS 204/);
  });

  it("fails pool enclosure, signatures, and engineering packs", () => {
    const failed = audit.failed.map((row) => row.id);
    assert.deepEqual(
      failed.filter((id) =>
        ["part-d", "signatures", "eng-packs", "xa-fenestration"].includes(id),
      ).sort(),
      ["eng-packs", "part-d", "signatures", "xa-fenestration"].sort(),
    );
    const pool = audit.failed.find((row) => row.id === "part-d");
    assert.match(pool?.adjust ?? "", /1\.2 m/);
    assert.match(pool?.adjust ?? "", /100 mm/);
  });

  it("passes coverage, parking, stairs, soakpit, lighting, and window types", () => {
    const passed = audit.passed.map((row) => row.id);
    assert.ok(passed.includes("parking"));
    assert.ok(passed.includes("coverage"));
    assert.ok(passed.includes("part-m"));
    assert.ok(passed.includes("part-r"));
    assert.ok(passed.includes("part-o"));
    assert.ok(passed.includes("window-schedule"));
    const windows = audit.passed.find((row) => row.id === "window-schedule");
    assert.match(windows?.detail ?? "", /W1/);
  });

  it("shows added text on the drawing and in the dxf", () => {
    const next = addVisibleText(extract, text, "Pool fence 1.2 m");
    const note = next.extract.geometry.find(
      (entity) => entity.kind === "text" && entity.value === "Pool fence 1.2 m",
    );
    assert.ok(note);
    assert.match(next.sourceText ?? "", /Pool fence 1\.2 m/);
    const dxf = buildAnnotatedDrawing(audit, next.extract, next.sourceText ?? undefined);
    assert.match(dxf, /Pool fence 1\.2 m/);
    assert.match(dxf, /COUNCIL_FIXES/);
  });

  it("writes a real annotated drawing with council layers", () => {
    const dxf = buildAnnotatedDrawing(audit, extract, text);
    assert.match(dxf, /COUNCIL_FIXES/);
    assert.match(dxf, /COUNCIL_CHECK/);
    assert.match(dxf, new RegExp(audit.verdict.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(dxf, /WINDOW_DIMS/);
    assert.doesNotMatch(dxf, /pre-submission audit/);
    assert.match(dxf, /ENTITIES/);
    assert.ok(!dxf.startsWith("Plancheck annotated drawing"));
    const bounds = geometryBounds(extract.geometry);
    assert.ok(bounds);
    const stamped = stampAudit(extract, audit);
    const notes = stamped.geometry.flatMap((entity) =>
      entity.kind === "text" &&
      (entity.layer === "COUNCIL_CHECK" || entity.layer === "COUNCIL_FIXES")
        ? [entity]
        : [],
    );
    assert.ok(notes.length > 1);
    for (const note of notes) {
      assert.ok(note.p.x >= bounds.minX && note.p.x <= bounds.maxX);
      assert.ok(note.p.y >= bounds.minY && note.p.y <= bounds.maxY);
      assert.ok(note.height < 280);
      assert.ok(dxf.includes(String(note.p.y)));
    }
  });
});

describe("hartley-test2 fixture", () => {
  const { audit } = load(
    "public/samples/hartley-test2.dxf",
    "hartley-test2.dxf",
  );

  it("classifies G1 medical offices from the drawing", () => {
    assert.equal(audit.occupancy, "G1");
    assert.equal(audit.occupancyNote, "medical offices");
  });

  it("fails the ground-truth Hartley set", () => {
    const failed = audit.failed.map((row) => row.id).sort();
    assert.deepEqual(failed, [
      "address",
      "eng-packs",
      "part-m",
      "part-r",
      "signatures",
      "titleblocks",
      "xa-fenestration",
    ]);
    const address = audit.failed.find((row) => row.id === "address");
    assert.match(address?.detail ?? "", /130 vs 132/);
  });
});
