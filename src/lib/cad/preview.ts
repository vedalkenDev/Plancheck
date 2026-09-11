import type { GeomEntity, Point } from "@/lib/cad/extract";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function geometryBounds(geometry: GeomEntity[]): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hit = false;

  function add(point: Point) {
    hit = true;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  for (const entity of geometry) {
    if (entity.kind === "line") {
      add(entity.a);
      add(entity.b);
    } else if (entity.kind === "polyline") {
      entity.points.forEach(add);
    } else if (entity.kind === "circle" || entity.kind === "arc") {
      add({ x: entity.c.x - entity.r, y: entity.c.y - entity.r });
      add({ x: entity.c.x + entity.r, y: entity.c.y + entity.r });
    } else if (entity.kind === "text") {
      add(entity.p);
    }
  }

  if (!hit || !Number.isFinite(minX)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  const start = (startDeg * Math.PI) / 180;
  const end = (endDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  let sweep = endDeg - startDeg;
  while (sweep < 0) {
    sweep += 360;
  }
  const large = sweep > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}
