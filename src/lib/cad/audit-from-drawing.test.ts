import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { addVisibleText, buildAnnotatedDrawing } from "./annotate";
import { auditFromDrawing } from "./audit-from-drawing";
import { extractDrawing } from "./extract";
import { geometryBounds } from "./preview";
import { stampAudit } from "./stamp";
import { occupancyFromText } from "../sans/occupancy";

function noteDrawing(lines: string[]) {
  return {
    format: "dxf" as const,
    texts: lines.map((value) => ({ kind: "text" as const, value })),
    strings: lines,
    entityCounts: {},
    geometry: [],
    sheets: [],
  };
}

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

  it("passes stairs only when a riser, going, or tread is stated", () => {
    const stated = auditFromDrawing("stairs.dxf", noteDrawing([
      "Stairs 170mm riser 250mm going Part M",
    ]));
    assert.ok(stated.passed.some((row) => row.id === "part-m"));

    const obligation = auditFromDrawing("min-tread.dxf", noteDrawing([
      "Min tread = 250mm to comply",
    ]));
    assert.equal(
      obligation.passed.some((row) => row.id === "part-m"),
      false,
    );

    const variance = auditFromDrawing("variance.dxf", noteDrawing([
      "6mm variance over the full height of the staircase",
    ]));
    assert.equal(
      variance.failed.find((row) => row.id === "part-m")?.detail,
      "Stair dims missing",
    );
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
    assert.equal(xa.clause?.book, "XA");
    assert.equal(xa.clause?.ref, "4.4");
    assert.equal(xa.clause?.label, "Building envelope requirements");
    assert.equal(xa.clause?.page, 9);
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
    assert.equal(windows?.clause?.ref, "4.2");
    assert.equal(windows?.clause?.book, "N");
    const stairs = audit.passed.find((row) => row.id === "part-m");
    assert.equal(stairs?.clause?.book, "M");
    assert.equal(stairs?.clause?.ref, "4.2");
    assert.equal(stairs?.clause?.page, 6);
    const occupancy = audit.passed.find((row) => row.id === "occupancy");
    assert.equal(occupancy?.clause?.ref, "A20");
    assert.equal(occupancy?.detail.includes("A20"), false);
    const coverage = audit.passed.find((row) => row.id === "coverage");
    assert.equal(coverage?.clause, undefined);
    const storm = audit.passed.find((row) => row.id === "part-r");
    assert.equal(storm?.clause?.ref, "R1");
    assert.equal(storm?.clause?.page, 149);
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
    assert.ok(notes.some((note) => note.value.includes("SANS 10400-XA 4.4")));
    assert.ok(notes.some((note) => note.value.includes("SANS 10400-M 4.2")));
    assert.ok(notes.some((note) => note.value.includes("7.05")));
    const frame = stamped.geometry.find(
      (entity) => entity.kind === "polyline" && entity.layer === "COUNCIL_CHECK",
    );
    assert.ok(frame && frame.kind === "polyline");
    for (const point of frame.points) {
      assert.ok(point.x >= bounds.minX && point.x <= bounds.maxX);
      assert.ok(point.y >= bounds.minY && point.y <= bounds.maxY);
    }
    const frameW =
      Math.max(...frame.points.map((point) => point.x)) -
      Math.min(...frame.points.map((point) => point.x));
    const frameH =
      Math.max(...frame.points.map((point) => point.y)) -
      Math.min(...frame.points.map((point) => point.y));
    assert.ok(frameH <= (bounds.maxY - bounds.minY) * 0.45 + 1);
    assert.ok(frameW <= bounds.maxX - bounds.minX);
    assert.match(dxf, / 73\n {5}3/);
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
    assert.equal(address?.clause?.ref, "A6");
    assert.equal(address?.clause?.page, 28);
    const stairs = audit.failed.find((row) => row.id === "part-m");
    assert.equal(stairs?.clause?.ref, "4.2");
    assert.equal(stairs?.clause?.book, "M");
  });
});
