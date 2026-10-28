"use client";

import { useEffect, useRef, useState } from "react";
import { SheetStage } from "@/components/sheet-camera";
import { openPdfDocument, renderPdfPage, type PdfDocument } from "@/lib/pdf/render-page";

type PdfPreviewProps = {
  bytes: ArrayBuffer;
  label: string;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

type SheetImage = {
  url: string;
  width: number;
  height: number;
};

export function PdfPreview({
  bytes,
  label,
  page,
  pageCount,
  onPage,
  fullscreen = false,
  onToggleFullscreen,
}: PdfPreviewProps) {
  const cacheRef = useRef<{ bytes: ArrayBuffer; pdf: PdfDocument } | null>(null);
  const shownUrl = useRef<string | null>(null);
  const [sheet, setSheet] = useState<SheetImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      setError(null);
      try {
        if (!cacheRef.current || cacheRef.current.bytes !== bytes) {
          await cacheRef.current?.pdf.loadingTask.destroy().catch(() => undefined);
          cacheRef.current = { bytes, pdf: await openPdfDocument(bytes) };
        }
        const rendered = await renderPdfPage(cacheRef.current.pdf, page);
        if (cancelled) {
          URL.revokeObjectURL(rendered.url);
          return;
        }
        setSheet((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous.url);
          }
          shownUrl.current = rendered.url;
          return rendered;
        });
      } catch {
        if (!cancelled) {
          setSheet(null);
          setError("This sheet could not be drawn.");
        }
      }
    }

    void draw();
    return () => {
      cancelled = true;
    };
  }, [bytes, page]);

  useEffect(() => {
    return () => {
      if (shownUrl.current) {
        URL.revokeObjectURL(shownUrl.current);
      }
      void cacheRef.current?.pdf.loadingTask.destroy().catch(() => undefined);
      cacheRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center bg-muted/30 p-4 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center bg-white text-sm text-neutral-500">
        Drawing the sheet…
      </div>
    );
  }

  return (
    <SheetStage
      label={label}
      frame={{ minX: 0, minY: 0, maxX: sheet.width, maxY: sheet.height }}
      resetKey={`${page}-${sheet.width}x${sheet.height}-${fullscreen ? "full" : "pane"}`}
      page={page}
      pageCount={pageCount}
      onPage={onPage}
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
    >
      <image href={sheet.url} width={sheet.width} height={sheet.height} />
    </SheetStage>
  );
}
