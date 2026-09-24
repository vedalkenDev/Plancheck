import type { AuditSample } from "@/data/types";
import type { DrawingExtract, GeomEntity, Point } from "@/lib/cad/extract";
import { geometryBounds } from "@/lib/cad/preview";
import { wrapText } from "@/lib/cad/preview";

const STAMP_LAYERS = new Set(["COUNCIL_CHECK", "COUNCIL_FIXES"]);

export function stampAudit(extract: DrawingExtract, audit: AuditSample): DrawingExtract {
  const base = extract.geometry.filter((entity) => !STAMP_LAYERS.has(entity.layer ?? ""));
  const bounds = geometryBounds(base);
  const span = bounds
    ? Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
    : 1000;
  const height = textHeight(base, span);
  const column = height * 42;
  const lines = stampLines(audit, column, height).slice(0, 16);
  const placed = placeLines(base, bounds, lines, height, column);

  return {
    ...extract,
    geometry: [...base, ...placed],
  };
}

function stampLines(audit: AuditSample, column: number, height: number) {
  const rows = [
    { layer: "COUNCIL_CHECK", text: audit.verdict, color: "#1c1917" },
    ...audit.failed.map((row) => ({
      layer: "COUNCIL_FIXES",
      text: `SANS ${row.part} ${row.check}. ${row.adjust}`,
      color: "#b91c1c",
    })),
  ];
  return rows.flatMap((row) =>
    wrapText(row.text, column, height).map((text) => ({
      layer: row.layer,
      text,
      color: row.color,
    })),
  );
}

function textHeight(geometry: GeomEntity[], span: number) {
  const heights = geometry
    .flatMap((entity) =>
      entity.kind === "text" && entity.height > 0 ? [entity.height] : [],
    )
    .filter((height) => height >= span / 500 && height <= span / 40)
    .sort((a, b) => a - b);
  if (!heights.length) {
    return Math.max(span / 160, 2.5);
  }
  return heights[Math.floor(heights.length / 2)];
}

function placeLines(
  geometry: GeomEntity[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null,
  lines: { layer: string; text: string; color: string }[],
  height: number,
  column: number,
): GeomEntity[] {
  const leading = height * 1.45;
  const blockH = Math.max(leading, lines.length * leading);
  const frame = bounds ?? { minX: 0, minY: 0, maxX: column * 2, maxY: blockH * 2 };
  const spot = clearestSpot(geometry, frame, column, blockH);
  const roomW = Math.max(frame.maxX - frame.minX, column);
  const roomH = Math.max(frame.maxY - frame.minY, blockH);
  spot.x = Math.min(Math.max(spot.x, frame.minX), frame.minX + roomW - Math.min(column, roomW));
  spot.y = Math.min(Math.max(spot.y, frame.minY), frame.minY + roomH - Math.min(blockH, roomH));
  const entities: GeomEntity[] = [
    {
      kind: "polyline",
      layer: "COUNCIL_CHECK",
      color: "#1c1917",
      closed: true,
      points: [
        { x: spot.x, y: spot.y },
        { x: spot.x + column, y: spot.y },
        { x: spot.x + column, y: spot.y + blockH },
        { x: spot.x, y: spot.y + blockH },
      ],
    },
  ];
  lines.forEach((line, index) => {
    entities.push({
      kind: "text",
      layer: line.layer,
      color: line.color,
      p: { x: spot.x + height * 0.4, y: spot.y + blockH - leading * index - height * 0.15 },
      height,
      value: line.text,
      valign: "top",
    });
  });
  return entities;
}

function clearestSpot(
  geometry: GeomEntity[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  column: number,
  blockH: number,
) {
  const cols = 28;
  const rows = 28;
  const grid = new Uint16Array(cols * rows);
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const cell = Math.min(width / cols, height / rows);
  const mark = (x: number, y: number) => {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(((x - bounds.minX) / width) * cols)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(((y - bounds.minY) / height) * rows)));
    grid[r * cols + c] += 1;
  };
  const segment = (a: Point, b: Point) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / cell));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      mark(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }
  };
  for (const entity of geometry) {
    occupy(entity, segment);
  }
  const needC = Math.max(1, Math.min(cols, Math.ceil((column / width) * cols)));
  const needR = Math.max(1, Math.min(rows, Math.ceil((blockH / height) * rows)));
  let best = { score: Number.POSITIVE_INFINITY, c: 0, r: 0 };
  for (let r = 0; r <= rows - needR; r += 1) {
    for (let c = 0; c <= cols - needC; c += 1) {
      let score = 0;
      for (let y = r; y < r + needR; y += 1) {
        for (let x = c; x < c + needC; x += 1) {
          score += grid[y * cols + x];
        }
      }
      if (score < best.score || (score === best.score && r > best.r)) {
        best = { score, c, r };
      }
    }
  }
  return {
    x: bounds.minX + (best.c / cols) * width,
    y: bounds.minY + (best.r / rows) * height,
  };
}

function occupy(entity: GeomEntity, segment: (a: Point, b: Point) => void) {
  if (entity.kind === "line") {
    segment(entity.a, entity.b);
    return;
  }
  if (entity.kind === "polyline") {
    for (let i = 1; i < entity.points.length; i += 1) {
      segment(entity.points[i - 1], entity.points[i]);
    }
    if (entity.closed && entity.points.length > 2) {
      segment(entity.points[entity.points.length - 1], entity.points[0]);
    }
    return;
  }
  if (entity.kind === "text") {
    const boxW =
      entity.width && entity.width > 0
        ? entity.width
        : Math.max(entity.height, entity.value.length * entity.height * 0.62);
    const top = entity.valign === "top" ? entity.p.y : entity.p.y + entity.height;
    const bottom = top - entity.height;
    const left = entity.p;
    const right = { x: entity.p.x + boxW, y: entity.p.y };
    segment({ x: left.x, y: bottom }, { x: right.x, y: bottom });
    segment({ x: left.x, y: top }, { x: right.x, y: top });
    return;
  }
  const steps = 8;
  for (let i = 0; i < steps; i += 1) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 1) / steps) * Math.PI * 2;
    segment(
      { x: entity.c.x + Math.cos(a0) * entity.r, y: entity.c.y + Math.sin(a0) * entity.r },
      { x: entity.c.x + Math.cos(a1) * entity.r, y: entity.c.y + Math.sin(a1) * entity.r },
    );
  }
}
