"use client";

import type { DrawingExtract, GeomEntity, Point } from "@/lib/cad/extract";
import { arcPath, geometryBounds } from "@/lib/cad/preview";

type DrawingPreviewProps = {
  extract: DrawingExtract;
  label: string;
};

export function DrawingPreview({ extract, label }: DrawingPreviewProps) {
  const bounds = geometryBounds(extract.geometry);

  if (!bounds) {
    return (
      <div className="flex h-full min-h-64 flex-col justify-between rounded-lg bg-muted/30 p-4 font-mono text-xs text-muted-foreground">
        <p className="text-foreground">{label}</p>
        <ul className="mt-4 space-y-1 overflow-auto">
          {extract.strings.slice(0, 18).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {extract.format === "dwg" ? (
          <p className="mt-4">
            This DWG could not be converted, so the plan preview is unavailable.
          </p>
        ) : null}
      </div>
    );
  }

  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
  const pad = span * 0.08;
  const minX = bounds.minX - pad;
  const minY = bounds.minY - pad;
  const width = Math.max(bounds.maxX - bounds.minX + pad * 2, 1);
  const height = Math.max(bounds.maxY - bounds.minY + pad * 2, 1);
  const stroke = Math.max(width, height) / 400;
  const fy = (y: number) => minY + height - (y - minY);
  const onSheet = (point: Point) =>
    point.x >= bounds.minX - span &&
    point.x <= bounds.maxX + span &&
    point.y >= bounds.minY - span &&
    point.y <= bounds.maxY + span;

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="h-full w-full min-h-64 text-foreground"
      role="img"
      aria-label={`Drawing preview of ${label}`}
    >
      <rect
        x={minX}
        y={minY}
        width={width}
        height={height}
        className="fill-muted/40"
      />
      {extract.geometry.map((entity, index) =>
        renderEntity(entity, index, {
          fy,
          stroke,
          span,
          onSheet,
        }),
      )}
    </svg>
  );
}

function renderEntity(
  entity: GeomEntity,
  index: number,
  ctx: {
    fy: (y: number) => number;
    stroke: number;
    span: number;
    onSheet: (point: Point) => boolean;
  },
) {
  const { fy, stroke, span, onSheet } = ctx;
  if (entity.kind === "line") {
    const length = Math.hypot(entity.b.x - entity.a.x, entity.b.y - entity.a.y);
    if (length > span * 4 || (!onSheet(entity.a) && !onSheet(entity.b))) {
      return null;
    }
    return (
      <line
        key={`l-${index}`}
        x1={entity.a.x}
        y1={fy(entity.a.y)}
        x2={entity.b.x}
        y2={fy(entity.b.y)}
        stroke="currentColor"
        strokeWidth={stroke}
      />
    );
  }
  if (entity.kind === "polyline") {
    const d = sheetPath(entity.points, entity.closed, span, fy, onSheet);
    if (!d) {
      return null;
    }
    return (
      <path
        key={`p-${index}`}
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
      />
    );
  }
  if (entity.kind === "circle" || entity.kind === "arc") {
    if (entity.r > span * 2 || !onSheet(entity.c)) {
      return null;
    }
  }
  if (entity.kind === "circle") {
    return (
      <circle
        key={`c-${index}`}
        cx={entity.c.x}
        cy={fy(entity.c.y)}
        r={entity.r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
      />
    );
  }
  if (entity.kind === "arc") {
    return (
      <path
        key={`a-${index}`}
        d={arcPath(entity.c.x, fy(entity.c.y), entity.r, entity.start, entity.end)}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
      />
    );
  }
  if (!onSheet(entity.p)) {
    return null;
  }
  return (
    <text
      key={`t-${index}`}
      x={entity.p.x}
      y={fy(entity.p.y)}
      fontSize={Math.max(entity.height, stroke * 8)}
      fill={entity.layer === "NOTE" ? "#f87171" : "currentColor"}
      opacity={0.9}
    >
      {entity.value.slice(0, 120)}
    </text>
  );
}

function sheetPath(
  points: Point[],
  closed: boolean,
  span: number,
  fy: (y: number) => number,
  onSheet: (point: Point) => boolean,
) {
  const source = closed && points.length ? [...points, points[0]] : points;
  let path = "";
  let open = false;
  for (let i = 0; i < source.length; i += 1) {
    const point = source[i];
    const previous = source[i - 1];
    const jump =
      previous !== undefined &&
      Math.hypot(point.x - previous.x, point.y - previous.y) > span * 4;
    if (!onSheet(point) || jump) {
      open = false;
      continue;
    }
    path += `${open ? "L" : "M"} ${point.x} ${fy(point.y)} `;
    open = true;
  }
  return path.trim();
}
