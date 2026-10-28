"use client";

import { useMemo } from "react";
import { SheetStage } from "@/components/sheet-camera";
import type { DrawingExtract, GeomEntity, Point } from "@/lib/cad/extract";
import { geometryBounds } from "@/lib/cad/preview";
import { arcPath, wrapText } from "@/lib/cad/preview";

type DrawingPreviewProps = {
  extract: DrawingExtract;
  label: string;
  page?: number;
  pageCount?: number;
  onPage?: (page: number) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

export function DrawingPreview({
  extract,
  label,
  page,
  pageCount,
  onPage,
  fullscreen = false,
  onToggleFullscreen,
}: DrawingPreviewProps) {
  const bounds = useMemo(() => {
    if (extract.pageWidth && extract.pageHeight) {
      return {
        minX: 0,
        minY: 0,
        maxX: extract.pageWidth,
        maxY: extract.pageHeight,
      };
    }
    return geometryBounds(extract.geometry);
  }, [extract.geometry, extract.pageHeight, extract.pageWidth]);

  const scene = useMemo(() => {
    if (!bounds) {
      return null;
    }
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
    const sy = (y: number) => bounds.minY + bounds.maxY - y;
    const onSheet = (point: Point) =>
      point.x >= bounds.minX - span &&
      point.x <= bounds.maxX + span &&
      point.y >= bounds.minY - span &&
      point.y <= bounds.maxY + span;
    return (
      <g>
        {extract.geometry.map((entity, index) =>
          renderEntity(entity, index, { sy, span, onSheet }),
        )}
      </g>
    );
  }, [bounds, extract.geometry]);

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

  return (
    <SheetStage
      label={label}
      frame={bounds}
      resetKey={`${label}-${fullscreen ? "full" : "pane"}-${page ?? 1}`}
      page={page}
      pageCount={pageCount}
      onPage={onPage}
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
    >
      {scene}
    </SheetStage>
  );
}

function renderEntity(
  entity: GeomEntity,
  index: number,
  ctx: {
    sy: (y: number) => number;
    span: number;
    onSheet: (point: Point) => boolean;
  },
) {
  const { sy, span, onSheet } = ctx;
  const ink = paperInk(entity.color);
  const stroke = {
    stroke: ink,
    strokeWidth: entity.weight ?? 1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: dashArray(entity.dash, span),
    vectorEffect: "non-scaling-stroke" as const,
    fill: "none" as const,
  };
  if (entity.kind === "line") {
    const length = Math.hypot(entity.b.x - entity.a.x, entity.b.y - entity.a.y);
    if (length > span * 4 || (!onSheet(entity.a) && !onSheet(entity.b))) {
      return null;
    }
    return (
      <line
        key={`l-${index}`}
        x1={entity.a.x}
        y1={sy(entity.a.y)}
        x2={entity.b.x}
        y2={sy(entity.b.y)}
        {...stroke}
      />
    );
  }
  if (entity.kind === "polyline") {
    const d = sheetPath(entity.points, entity.closed, span, sy, onSheet);
    if (!d) {
      return null;
    }
    const pattern = entity.pattern;
    return (
      <g key={`p-${index}`}>
        {pattern !== undefined ? (
          <defs>
            <pattern
              id={`hatch-${index}`}
              patternUnits="userSpaceOnUse"
              width={span / 28}
              height={span / 28}
              patternTransform={`rotate(${-pattern})`}
            >
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={span / 28}
                stroke={ink}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
          </defs>
        ) : null}
        <path
          d={d}
          {...stroke}
          fill={
            entity.fill ? ink : pattern !== undefined ? `url(#hatch-${index})` : "none"
          }
          fillOpacity={entity.fill ? 0.22 : undefined}
        />
      </g>
    );
  }
  if ((entity.kind === "circle" || entity.kind === "arc") && (entity.r > span * 2 || !onSheet(entity.c))) {
    return null;
  }
  if (entity.kind === "circle") {
    return (
      <circle key={`c-${index}`} cx={entity.c.x} cy={sy(entity.c.y)} r={entity.r} {...stroke} />
    );
  }
  if (entity.kind === "arc") {
    return (
      <path
        key={`a-${index}`}
        d={arcPath(entity.c.x, sy(entity.c.y), entity.r, entity.start, entity.end)}
        {...stroke}
      />
    );
  }
  if (entity.kind !== "text" || !onSheet(entity.p)) {
    return null;
  }
  const x = entity.p.x;
  const y = sy(entity.p.y);
  const fontSize = entity.height;
  const lines = wrapText(entity.value, entity.width, fontSize);
  const leading = fontSize * 1.6;
  const shift =
    entity.valign === "top"
      ? 0
      : entity.valign === "middle"
        ? -((lines.length - 1) * leading) / 2
        : -((lines.length - 1) * leading);
  return (
    <text
      key={`t-${index}`}
      x={x}
      y={y}
      fontSize={fontSize}
      fontFamily="ui-sans-serif, system-ui, sans-serif"
      textAnchor={entity.align === "center" ? "middle" : entity.align === "right" ? "end" : "start"}
      dominantBaseline={
        entity.valign === "middle" ? "middle" : entity.valign === "top" ? "hanging" : "auto"
      }
      transform={entity.rotation ? `rotate(${-entity.rotation} ${x} ${y})` : undefined}
      fill={entity.layer === "NOTE" ? "#dc2626" : ink}
    >
      {lines.map((line, lineIndex) => (
        <tspan key={lineIndex} x={x} dy={lineIndex === 0 ? shift : leading}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function paperInk(color: string | undefined) {
  if (!color || color.toLowerCase() === "#ffffff") {
    return "#1c1917";
  }
  if (color.toLowerCase() === "#ffff00") {
    return "#a16207";
  }
  return color;
}

function dashArray(dash: number[] | undefined, span: number) {
  if (!dash?.length) {
    return undefined;
  }
  const length = dash.reduce((sum, part) => sum + Math.abs(part), 0);
  const scale = length > 0 && (length < span / 500 || length > span / 8) ? span / 36 / length : 1;
  const parts = dash.map((part) => Math.max(Math.abs(part) * scale, span / 900));
  if (dash[0] < 0) {
    parts.unshift(0);
  }
  return parts.join(" ");
}

function sheetPath(
  points: Point[],
  closed: boolean,
  span: number,
  sy: (y: number) => number,
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
    path += `${open ? "L" : "M"} ${point.x} ${sy(point.y)} `;
    open = true;
  }
  return path.trim();
}
