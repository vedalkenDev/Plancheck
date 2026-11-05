"use client";

import { Minus, Plus, Scaling } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getDocumentProxy } from "unpdf";
import { Button } from "@/components/ui/button";

type PdfDoc = Awaited<ReturnType<typeof getDocumentProxy>>;

const MAX_PX = 8192;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;

export function PdfPageView({
  bytes,
  label,
  page,
}: {
  bytes: ArrayBuffer;
  label: string;
  page: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PdfDoc | null>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [status, setStatus] = useState(`Drawing sheet ${page}…`);
  const [drawnPage, setDrawnPage] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (next > 2) {
        setWidth(next);
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 8) {
      return;
    }
    const surface = canvas;
    let cancelled = false;

    async function draw() {
      try {
        if (bytesRef.current !== bytes || !pdfRef.current) {
          await closePdf(pdfRef.current);
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(new Uint8Array(bytes));
          pdfRef.current = await getDocumentProxy(copy, { maxImageSize: 16_777_216 });
          bytesRef.current = bytes;
        }
        const pdf = pdfRef.current;
        const pdfPage = await pdf.getPage(page);
        const base = pdfPage.getViewport({ scale: 1 });
        const dpr = window.devicePixelRatio || 1;
        const fit = width / base.width;
        const scale = Math.min(fit * zoom * dpr, MAX_PX / base.width, MAX_PX / base.height);
        const viewport = pdfPage.getViewport({ scale: Math.max(0.1, scale) });
        surface.width = Math.floor(viewport.width);
        surface.height = Math.floor(viewport.height);
        surface.style.width = `${Math.floor(viewport.width / dpr)}px`;
        surface.style.height = `${Math.floor(viewport.height / dpr)}px`;
        const ctx = surface.getContext("2d");
        if (!ctx) {
          throw new Error("canvas");
        }
        await pdfPage.render({
          canvas: surface,
          canvasContext: ctx,
          viewport,
        }).promise;
        if (!cancelled) {
          setDrawnPage(page);
        }
      } catch {
        if (!cancelled) {
          setStatus("This sheet could not be drawn.");
        }
      }
    }

    void draw();
    return () => {
      cancelled = true;
    };
  }, [bytes, page, zoom, width]);

  useEffect(
    () => () => {
      void closePdf(pdfRef.current);
      pdfRef.current = null;
    },
    [],
  );

  return (
    <div className="relative h-full min-h-[22rem] w-full">
      <div ref={hostRef} className="h-full overflow-auto bg-white">
        <canvas
          ref={canvasRef}
          aria-label={label}
          className={`mx-auto block bg-white ${drawnPage === page ? "" : "invisible"}`}
        />
      </div>
      {drawnPage === page ? null : (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-sm text-muted-foreground">
          {status}
        </p>
      )}
      <div className="absolute bottom-2 left-2 z-10 flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Math.round((value / 1.25) * 100) / 100))}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Fit page"
          onClick={() => setZoom(1)}
        >
          <Scaling />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Math.round(value * 1.25 * 100) / 100))}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

async function closePdf(pdf: PdfDoc | null) {
  if (!pdf) {
    return;
  }
  await pdf.cleanup();
  await pdf.loadingTask.destroy();
}
