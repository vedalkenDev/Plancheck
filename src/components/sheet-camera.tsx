"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Minus, Plus, Scaling } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  cameraViewBox,
  clampZoom,
  fitCamera,
  panCamera,
  resizeCamera,
  zoomCamera,
  zoomPercent,
  type Camera,
  type Frame,
} from "@/lib/cad/camera";

const ZOOM_STEP = 1.25;

function SheetChrome({
  label,
  percent,
  page,
  pageCount,
  onPage,
  onFit,
  onZoomIn,
  onZoomOut,
  fullscreen = false,
  onToggleFullscreen,
}: {
  label: string;
  percent: number;
  page?: number;
  pageCount?: number;
  onPage?: (page: number) => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const pages = pageCount ?? 1;
  const current = page ?? 1;
  const showPages = pages > 1 && onPage;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-1 rounded-lg border bg-background p-1 shadow-md">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Fit drawing" onClick={onFit}>
          <Scaling />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={onZoomOut}>
          <Minus />
        </Button>
        <span className="min-w-10 text-center font-mono text-xs tabular-nums text-muted-foreground">
          {percent}%
        </span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={onZoomIn}>
          <Plus />
        </Button>
        {showPages ? (
          <>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Previous sheet"
              disabled={current <= 1}
              onClick={() => onPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <label className="flex items-center gap-1 px-1 font-mono text-xs tabular-nums">
              <span className="sr-only">Sheet</span>
              <input
                type="number"
                min={1}
                max={pages}
                value={current}
                aria-label={`${label}, sheet ${current} of ${pages}`}
                className="h-7 w-10 rounded-md border border-transparent bg-transparent text-center outline-none [appearance:textfield] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isInteger(next) && next >= 1 && next <= pages) {
                    onPage(next);
                  }
                }}
              />
              <span className="text-muted-foreground">/ {pages}</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Next sheet"
              disabled={current >= pages}
              onClick={() => onPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </>
        ) : null}
        {onToggleFullscreen ? (
          <>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={onToggleFullscreen}
            >
              {fullscreen ? <Minimize2 /> : <Maximize2 />}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function SheetStage({
  label,
  frame,
  resetKey,
  page,
  pageCount,
  onPage,
  fullscreen,
  onToggleFullscreen,
  children,
}: {
  label: string;
  frame: Frame;
  resetKey: string | number;
  page?: number;
  pageCount?: number;
  onPage?: (page: number) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewSizeRef = useRef({ w: 320, h: 480 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; camera: Camera } | null>(
    null,
  );
  const [camera, setCamera] = useState<Camera | null>(() => fitCamera(frame, 320, 480));
  const cameraRef = useRef<Camera | null>(camera);
  const [dragging, setDragging] = useState(false);
  const [percent, setPercent] = useState(100);
  const percentRef = useRef(100);
  const frameRef = useRef(frame);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  const apply = useCallback((next: Camera, commit = false) => {
    cameraRef.current = next;
    svgRef.current?.setAttribute("viewBox", cameraViewBox(next));
    const host = hostRef.current;
    const live = frameRef.current;
    if (host && live) {
      const rect = host.getBoundingClientRect();
      if (rect.width >= 2 && rect.height >= 2) {
        const nextPercent = zoomPercent(fitCamera(live, rect.width, rect.height), next);
        if (nextPercent !== percentRef.current) {
          percentRef.current = nextPercent;
          setPercent(nextPercent);
        }
      }
    }
    if (commit) {
      setCamera(next);
    }
  }, []);

  const fitToHost = useCallback(
    (commit = true) => {
      const live = frameRef.current;
      const host = hostRef.current;
      if (!live || !host) {
        return;
      }
      const rect = host.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        return;
      }
      viewSizeRef.current = { w: rect.width, h: rect.height };
      apply(fitCamera(live, rect.width, rect.height), commit);
    },
    [apply],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const current = cameraRef.current;
      const live = frameRef.current;
      if (!current || !live) {
        return;
      }
      const { w, h } = viewSizeRef.current;
      apply(clampZoom(current, live, zoomCamera(current, factor, w / 2, h / 2, w, h)), true);
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
  }, [fitToHost, resetKey]);

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
      const live = frameRef.current;
      if (!current || !live || !host) {
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
      apply(clampZoom(current, live, next));
    }
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [apply]);

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || !cameraRef.current) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    hostRef.current?.focus();
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

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(ZOOM_STEP);
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomBy(1 / ZOOM_STEP);
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      fitToHost();
      return;
    }
    if (!onPage || !page || !pageCount) {
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      if (page > 1) {
        onPage(page - 1);
      }
      return;
    }
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      if (page < pageCount) {
        onPage(page + 1);
      }
    }
  }

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative h-full min-h-64 w-full overflow-hidden bg-white outline-none"
    >
      {camera ? (
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
          {children}
        </svg>
      ) : null}
      <SheetChrome
        label={label}
        percent={percent}
        page={page}
        pageCount={pageCount}
        onPage={onPage}
        onFit={() => fitToHost()}
        onZoomIn={() => zoomBy(ZOOM_STEP)}
        onZoomOut={() => zoomBy(1 / ZOOM_STEP)}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    </div>
  );
}
