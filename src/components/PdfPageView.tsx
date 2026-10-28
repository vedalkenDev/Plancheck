"use client";

import { ExternalLink, Minus, Plus, Scaling } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getDocumentProxy } from "unpdf";
import { Button } from "@/components/ui/button";

type PdfDoc = Awaited<ReturnType<typeof getDocumentProxy>>;

const MAX_PX = 8192;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 8;

export function PdfPageView({
  bytes,
  url,
  label,
  page,
}: {
  bytes: ArrayBuffer;
  url: string;
  label: string;
  page: number;
}) {
  const [draw, setDraw] = useState(false);
  const src = `${url}#page=${page}&view=FitH&toolbar=1&navpanes=0`;

  return (
    <div className="relative h-full min-h-[22rem] w-full bg-neutral-200 dark:bg-neutral-900">
      {draw ? (
        <DrawnPage bytes={bytes} label={label} page={page} />
      ) : (
        <iframe
          key={page}
          title={label}
          src={src}
          className="h-full w-full border-0 bg-white"
        />
      )}
      <div className="absolute right-2 bottom-2 z-10 flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setDraw((value) => !value)}
        >
          {draw ? "PDF viewer" : "Draw sheet"}
        </Button>
        <Button type="button" variant="secondary" size="sm" asChild>
          <a href={src} target="_blank" rel="noreferrer">
            <ExternalLink />
            Open PDF
          </a>
        </Button>
      </div>
    </div>
  );
}

function DrawnPage({
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
  const [pageWidth, setPageWidth] = useState(0);
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

    async function drawPage() {
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
        if (!cancelled) {
          setPageWidth(base.width);
        }
        const dpr = window.devicePixelRatio || 1;
        const scale = Math.min(zoom * dpr, MAX_PX / base.width, MAX_PX / base.height);
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

    void drawPage();
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

  const fitZoom = pageWidth > 0 && width > 8 ? width / pageWidth : 1;

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
          onClick={() => setZoom((value) => Math.max(MIN_ZOOM, roundZoom(value / 1.25)))}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Fit page"
          onClick={() => setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, roundZoom(fitZoom))))}
        >
          <Scaling />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom((value) => Math.min(MAX_ZOOM, roundZoom(value * 1.25)))}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function roundZoom(value: number) {
  return Math.round(value * 100) / 100;
}

async function closePdf(pdf: PdfDoc | null) {
  if (!pdf) {
    return;
  }
  await pdf.cleanup();
  await pdf.loadingTask.destroy();
}
