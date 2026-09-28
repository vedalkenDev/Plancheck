import type { AuditSample } from "@/data/types";
import type { DrawingExtract, GeomEntity } from "@/lib/cad/extract";
import { geometryBounds } from "@/lib/cad/preview";
import { stampAudit } from "@/lib/cad/stamp";

const LAYERS = [
  { name: "COUNCIL_CHECK", color: 250 },
  { name: "COUNCIL_FIXES", color: 1 },
] as const;

const STAMP_LAYERS = new Set<string>(LAYERS.map((layer) => layer.name));

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
  const stamped = extract.geometry.some((entity) => STAMP_LAYERS.has(entity.layer ?? ""))
    ? extract
    : stampAudit(extract, audit);
  const notes = stamped.geometry
    .filter((entity) => STAMP_LAYERS.has(entity.layer ?? ""))
    .map(entityToDxf)
    .join("\n");
  if (originalText && looksLikeDxf(originalText)) {
    return injectEntities(originalText, notes);
  }
  return standaloneDxf(stamped, "");
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
    ...dxfColor(entity.layer),
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

function dxfColor(layer: string | undefined) {
  if (layer === "COUNCIL_FIXES") {
    return [" 62", "     1"];
  }
  if (layer === "COUNCIL_CHECK") {
    return [" 62", "   250"];
  }
  return [];
}
