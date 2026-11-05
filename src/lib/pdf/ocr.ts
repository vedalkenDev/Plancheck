import type { PdfLine } from "@/lib/pdf/text";
import { uniqueLines } from "@/lib/pdf/text";
import { getResolvedPDFJS } from "unpdf";

type PdfDoc = Awaited<ReturnType<(typeof import("unpdf"))["getDocumentProxy"]>>;
type TessWorker = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>;
type TessLine = import("tesseract.js").Line;

export const MIN_VECTOR_LINES = 5;
export const MIN_OCR_CONFIDENCE = 40;
const MAX_OCR_PX = 2000;
const LARGE_RASTER_PX = 100_000;

export type OcrBox = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type OcrSession = {
  recognize(image: Buffer | Blob): Promise<OcrBox[]>;
  terminate(): Promise<void>;
};

/** Vector notes stay on the fast path. OCR runs when the sheet is a picture. */
export function pageNeedsOcr(vectorLines: PdfLine[]) {
  return uniqueLines(vectorLines.map((line) => line.value)).length < MIN_VECTOR_LINES;
}

export function ocrScale(width: number, height: number) {
  const longest = Math.max(width, height, 1);
  return Math.max(0.5, Math.min(2.5, MAX_OCR_PX / longest));
}

export function linesFromOcr(
  boxes: OcrBox[],
  scale: number,
  pageHeight: number,
): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const box of boxes) {
    const value = box.text.replace(/\s+/g, " ").trim();
    if (!value || box.confidence < MIN_OCR_CONFIDENCE) {
      continue;
    }
    const width = Math.max(box.bbox.x1 - box.bbox.x0, 0) / scale;
    const height = Math.max(box.bbox.y1 - box.bbox.y0, 0) / scale;
    lines.push({
      value,
      x: box.bbox.x0 / scale,
      y: pageHeight - box.bbox.y1 / scale,
      width,
      height: height || 12,
    });
  }
  return lines;
}

export async function pageHasLargeRaster(pdf: PdfDoc, pageNumber: number) {
  try {
    const pdfjs = await getResolvedPDFJS();
    const page = await pdf.getPage(pageNumber);
    const list = await page.getOperatorList();
    const paint = new Set([pdfjs.OPS.paintImageXObject].filter((op) => Number.isFinite(op)));
    for (let i = 0; i < list.fnArray.length; i += 1) {
      if (!paint.has(list.fnArray[i])) {
        continue;
      }
      const key = String((list.argsArray[i] as unknown[])[0] ?? "");
      if (!key) {
        continue;
      }
      const image = await imageObject(page, key);
      const width = Number(image?.width) || 0;
      const height = Number(image?.height) || 0;
      if (width * height >= LARGE_RASTER_PX) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export async function createOcrSession(): Promise<OcrSession> {
  const { createWorker } = await import("tesseract.js");
  const worker: TessWorker = await createWorker(
    "eng",
    1,
    typeof window === "undefined" ? { cachePath: "/tmp" } : undefined,
  );
  return {
    async recognize(image) {
      const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
      return boxesFromBlocks(data.blocks ?? []);
    },
    async terminate() {
      await worker.terminate();
    },
  };
}

export async function rasterPdfPage(
  pdf: PdfDoc,
  pageNumber: number,
  width: number,
  height: number,
): Promise<{ image: Buffer | Blob; scale: number }> {
  const scale = ocrScale(width, height);
  if (typeof window === "undefined") {
    const { rasterPdfPageNode } = await import("./ocr-node");
    return rasterPdfPageNode(pdf, pageNumber, scale);
  }
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas");
  }
  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  }).promise;
  const image = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png");
  });
  return { image, scale };
}

function boxesFromBlocks(blocks: Array<{ paragraphs?: Array<{ lines?: TessLine[] }> }>): OcrBox[] {
  const boxes: OcrBox[] = [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        boxes.push({
          text: line.text,
          confidence: line.confidence,
          bbox: line.bbox,
        });
      }
    }
  }
  return boxes;
}

function imageObject(page: { objs: ObjStore; commonObjs: ObjStore }, key: string) {
  return new Promise<{ width?: number; height?: number } | null>((resolve) => {
    const store = key.startsWith("g_") ? page.commonObjs : page.objs;
    store.get(key, (value: { width?: number; height?: number } | null) => resolve(value ?? null));
  });
}

type ObjStore = {
  get: (key: string, callback: (value: { width?: number; height?: number } | null) => void) => void;
};
