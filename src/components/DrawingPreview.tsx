"use client";

import { Maximize2, Minimize2, Scaling } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DrawingExtract, GeomEntity, Point } from "@/lib/cad/extract";
import {
  cameraViewBox,
  clampZoom,
  fitCamera,
  panCamera,
  resizeCamera,
  zoomCamera,
  type Camera,
} from "@/lib/cad/camera";
import { arcPath, geometryBounds, wrapText } from "@/lib/cad/preview";

type DrawingPreviewProps = {
  extract: DrawingExtract;
  label: string;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

export function DrawingPreview({
  extract,
  label,
  fullscreen = false,
  onToggleFullscreen,
}: DrawingPreviewProps) {
  const bounds = useMemo(() => geometryBounds(extract.geometry), [extract.geometry]);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewSizeRef = useRef({ w: 320, h: 480 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; camera: Camera } | null>(
    null,
  );
  const [camera, setCamera] = useState<Camera | null>(() =>
    bounds ? fitCamera(bounds, 320, 480) : null,
  );
  const cameraRef = useRef<Camera | null>(camera);
  const [dragging, setDragging] = useState(false);
  const boundsRef = useRef(bounds);

  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  const apply = useCallback((next: Camera, commit = false) => {
    cameraRef.current = next;
    svgRef.current?.setAttribute("viewBox", cameraViewBox(next));
    if (commit) {
      setCamera(next);
    }
  }, []);

  const fitToHost = useCallback(
    (commit = true) => {
      const frame = boundsRef.current;
      const host = hostRef.current;
      if (!frame || !host) {
        return;
      }
      const rect = host.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        return;
      }
      viewSizeRef.current = { w: rect.width, h: rect.height };
      apply(fitCamera(frame, rect.width, rect.height), commit);
    },
    [apply],
  );

  useLayoutEffect(() => {
    const live = cameraRef.current;
    if (live && svgRef.current) {
      svgRef.current.setAttribute("viewBox", cameraViewBox(live));
    }
  });

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => fitToHost());
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [fitToHost, fullscreen, label]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const rect = host.getBoundingClientRect();
      const previous = viewSizeRef.current;
      const current = cameraRef.current;
      if (!current || rect.width < 2 || rect.height < 2) {
        return;
      }
      if (Math.abs(rect.width - previous.w) < 1 && Math.abs(rect.height - previous.h) < 1) {
        return;
      }
      apply(resizeCamera(current, previous.w, rect.width, rect.height));
      viewSizeRef.current = { w: rect.width, h: rect.height };
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [apply]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    function onWheel(event: WheelEvent) {
      const current = cameraRef.current;
      const frame = boundsRef.current;
      if (!current || !frame || !host) {
        return;
      }
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      const next = zoomCamera(
        current,
        factor,
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
      apply(clampZoom(current, frame, next));
    }
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [apply]);

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

  if (!bounds || !camera) {
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

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || !cameraRef.current) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: cameraRef.current,
    };
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const host = hostRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !host) {
      return;
    }
    const rect = host.getBoundingClientRect();
    apply(
      panCamera(
        drag.camera,
        event.clientX - drag.x,
        event.clientY - drag.y,
        rect.width,
        rect.height,
      ),
    );
  }

  function endDrag(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    setDragging(false);
    if (cameraRef.current) {
      setCamera(cameraRef.current);
    }
  }

  return (
    <div
      ref={hostRef}
      className="relative h-full min-h-64 w-full overflow-hidden bg-white"
    >
      <svg
        ref={svgRef}
        viewBox={cameraViewBox(camera)}
        className={`absolute inset-0 h-full w-full touch-none text-neutral-950 select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        role="application"
        aria-label={`${label}. Drag to move the drawing. Scroll to zoom.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => fitToHost()}
      >
        {scene}
      </svg>
      <div className="absolute top-2 left-2 z-10 flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Fit drawing"
          onClick={() => fitToHost()}
        >
          <Scaling />
        </Button>
        {onToggleFullscreen ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={onToggleFullscreen}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        ) : null}
      </div>
    </div>
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
  const fontSize = Math.max(entity.height, span / 400);
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
