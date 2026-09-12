"use client";

import type { DrawingExtract } from "@/lib/cad/extract";
import { arcPath, geometryBounds } from "@/lib/cad/preview";

type DrawingPreviewProps = {
  extract: DrawingExtract;
  label: string;
};

export function DrawingPreview({ extract, label }: DrawingPreviewProps) {
  const drawable = extract.geometry.filter((entity) => entity.kind !== "text");
  const bounds = geometryBounds(extract.geometry);

  if (!drawable.length || !bounds) {
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
        Geometry is not in this drawing. Export from CAD to preview the plan.
          </p>
        ) : null}
      </div>
    );
  }

  const pad = 800;
  const minX = bounds.minX - pad;
  const minY = bounds.minY - pad;
  const width = Math.max(bounds.maxX - bounds.minX + pad * 2, 1);
  const height = Math.max(bounds.maxY - bounds.minY + pad * 2, 1);
  const stroke = Math.max(width, height) / 400;
  const fy = (y: number) => minY + height - (y - minY);

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
      {extract.geometry.map((entity, index) => {
        if (entity.kind === "line") {
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
          const d =
            entity.points
              .map(
                (point, i) =>
                  `${i === 0 ? "M" : "L"} ${point.x} ${fy(point.y)}`,
              )
              .join(" ") + (entity.closed ? " Z" : "");
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
        return (
          <text
            key={`t-${index}`}
            x={entity.p.x}
            y={fy(entity.p.y)}
            fontSize={Math.max(entity.height, stroke * 8)}
            fill="currentColor"
            className="opacity-80"
          >
            {entity.value.slice(0, 42)}
          </text>
        );
      })}
    </svg>
  );
}
