import type { AuditSample } from "@/data/types";
import type { DrawingExtract, GeomEntity } from "@/lib/cad/extract";
import { geometryBounds } from "@/lib/cad/preview";
import { DISCLAIMER } from "@/lib/checklist";

const LAYERS = [
  { name: "COUNCIL_CHECK", color: 3 },
  { name: "WIN_SCHED", color: 4 },
  { name: "COUNCIL_FIXES", color: 1 },
  { name: "WINDOW_DIMS", color: 5 },
] as const;

export function addVisibleText(
  extract: DrawingExtract,
  sourceText: string | null | undefined,
  value: string,
) {
  const text = value.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!text) {
    return { extract, sourceText: sourceText ?? null };
  }

  const bounds = geometryBounds(extract.geometry);
  const span = bounds
    ? Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
    : 1000;
  const height = span / 16;
  const placed = extract.geometry.filter(
    (entity) => entity.kind === "text" && entity.layer === "NOTE",
  ).length;
  const x = bounds ? bounds.minX : 0;
  const y = (bounds ? bounds.maxY : height) - height * 1.35 * placed;
  const entity: GeomEntity = {
    kind: "text",
    layer: "NOTE",
    p: { x, y },
    height,
    value: text,
  };
  const note = dxfText("NOTE", x, y, height, text);
  const dxf =
    sourceText && looksLikeDxf(sourceText)
      ? injectEntities(sourceText, note)
      : (sourceText ?? null);

  return {
    extract: {
      ...extract,
      texts: [...extract.texts, { kind: "text" as const, value: text, layer: "NOTE" }],
      strings: extract.strings.includes(text) ? extract.strings : [...extract.strings, text],
      geometry: [...extract.geometry, entity],
    },
    sourceText: dxf,
  };
}

export function buildAnnotatedDrawing(
  audit: AuditSample,
  extract: DrawingExtract,
  originalText?: string,
) {
  const notes = annotationEntities(audit, extract);
  if (originalText && looksLikeDxf(originalText)) {
    return injectEntities(originalText, notes);
  }
  return standaloneDxf(extract, notes);
}

function annotationEntities(audit: AuditSample, extract: DrawingExtract) {
  const bounds = geometryBounds(extract.geometry);
  const x = bounds ? bounds.maxX + 1200 : 0;
  let y = bounds ? bounds.maxY : 16000;
  const height = 280;
  const gap = 420;
  const lines: string[] = [];

  function add(layer: string, text: string) {
    lines.push(dxfText(layer, x, y, height, text));
    y -= gap;
  }

  add("COUNCIL_CHECK", "PLANCHECK — pre-submission audit");
  add("COUNCIL_CHECK", DISCLAIMER);
  add("COUNCIL_CHECK", `${audit.occupancy} · ${audit.occupancyNote}`);
  add("COUNCIL_CHECK", audit.verdict);
  y -= gap / 2;
  add("COUNCIL_FIXES", "FAILED");
  for (const row of audit.failed) {
    add("COUNCIL_FIXES", `${row.part} ${row.check}: ${row.adjust}`);
  }
  y -= gap / 2;
  add("COUNCIL_CHECK", "PASSED");
  for (const row of audit.passed) {
    add("COUNCIL_CHECK", `${row.part} ${row.check}: ${row.detail}`);
  }

  const windows = audit.passed.find((row) => row.id === "window-schedule");
  if (windows) {
    y -= gap / 2;
    add("WIN_SCHED", `Window schedule: ${windows.detail}`);
    add("WINDOW_DIMS", "Show overall and pane sizes on each window type elevation.");
  } else if (audit.failed.some((row) => row.id === "window-schedule")) {
    y -= gap / 2;
    add("WIN_SCHED", "Window schedule missing — type elevations with pane sizes required.");
    add("WINDOW_DIMS", "Draw overall + pane dimensions in free space on the sheet.");
  }

  return lines.join("\n");
}

function standaloneDxf(extract: DrawingExtract, notes: string) {
  const geometry = extract.geometry.map(entityToDxf).filter(Boolean).join("\n");
  return [
    "  0",
    "SECTION",
    "  2",
    "HEADER",
    "  9",
    "$INSUNITS",
    " 70",
    "     4",
    "  0",
    "ENDSEC",
    "  0",
    "SECTION",
    "  2",
    "TABLES",
    "  0",
    "TABLE",
    "  2",
    "LAYER",
    " 70",
    String(LAYERS.length).padStart(6, " "),
    ...LAYERS.flatMap((layer) => [
      "  0",
      "LAYER",
      "  2",
      layer.name,
      " 70",
      "     0",
      " 62",
      String(layer.color).padStart(6, " "),
      "  6",
      "CONTINUOUS",
    ]),
    "  0",
    "ENDTAB",
    "  0",
    "ENDSEC",
    "  0",
    "SECTION",
    "  2",
    "ENTITIES",
    geometry,
    notes,
    "  0",
    "ENDSEC",
    "  0",
    "EOF",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n")
    .concat("\n");
}

function injectEntities(dxf: string, notes: string) {
  const idx = dxf.lastIndexOf("ENDSEC");
  if (idx === -1) {
    return `${dxf.trimEnd()}\n${notes}\n`;
  }
  return `${dxf.slice(0, idx)}${notes}\n${dxf.slice(idx)}`;
}

function looksLikeDxf(text: string) {
  return text.includes("SECTION") && (text.includes("ENTITIES") || text.includes("EOF"));
}

function dxfText(layer: string, x: number, y: number, height: number, value: string) {
  const safe = value.replace(/\r?\n/g, " ").slice(0, 250);
  return [
    "  0",
    "TEXT",
    "  8",
    layer,
    " 10",
    x.toFixed(1),
    " 20",
    y.toFixed(1),
    " 40",
    height.toFixed(1),
    "  1",
    safe,
  ].join("\n");
}

function entityToDxf(entity: GeomEntity) {
  if (entity.kind === "line") {
    return [
      "  0",
      "LINE",
      "  8",
      entity.layer ?? "0",
      " 10",
      entity.a.x,
      " 20",
      entity.a.y,
      " 11",
      entity.b.x,
      " 21",
      entity.b.y,
    ].join("\n");
  }
  if (entity.kind === "polyline") {
    return [
      "  0",
      "LWPOLYLINE",
      "  8",
      entity.layer ?? "0",
      " 90",
      String(entity.points.length).padStart(6, " "),
      " 70",
      entity.closed ? "     1" : "     0",
      ...entity.points.flatMap((point) => [" 10", point.x, " 20", point.y]),
    ].join("\n");
  }
  if (entity.kind === "circle") {
    return [
      "  0",
      "CIRCLE",
      "  8",
      entity.layer ?? "0",
      " 10",
      entity.c.x,
      " 20",
      entity.c.y,
      " 40",
      entity.r,
    ].join("\n");
  }
  if (entity.kind === "arc") {
    return [
      "  0",
      "ARC",
      "  8",
      entity.layer ?? "0",
      " 10",
      entity.c.x,
      " 20",
      entity.c.y,
      " 40",
      entity.r,
      " 50",
      entity.start,
      " 51",
      entity.end,
    ].join("\n");
  }
  return [
    "  0",
    "TEXT",
    "  8",
    entity.layer ?? "0",
    " 10",
    entity.p.x,
    " 20",
    entity.p.y,
    " 40",
    entity.height || 200,
    "  1",
    entity.value.slice(0, 250),
  ].join("\n");
}
