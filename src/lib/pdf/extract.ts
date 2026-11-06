import type { DrawingExtract, DrawingSheet, DrawingText, GeomEntity } from "@/lib/cad/extract";
import {
  createOcrSession,
  linesFromOcr,
  pageHasLargeRaster,
  pageNeedsOcr,
  rasterPdfPage,
  type OcrSession,
} from "@/lib/pdf/ocr";
import { extractPagePaths, MAX_PAGE_PATHS } from "@/lib/pdf/paths";
import { reconstructPdfLines, uniqueLines } from "@/lib/pdf/text";
import { extractTextItems, getDocumentProxy } from "unpdf";

export type ExtractProgress = {
  page: number;
  total: number;
  startedAt?: number;
  ocr?: boolean;
};

export type ExtractPdfOptions = {
  onProgress?: (info: ExtractProgress) => void;
  maxEntities?: number;
};

const SHEET_TITLE =
  /proposed|window schedule|\bschedule\b|elevation|section|layout|(?:site|floor|roof)\s*plan|title\s*block/i;

/**
 * Council packs are PDF. Vector text is read first. Flattened / scanned sheets
 * (no text layer, or notes pasted as a picture) go through in-browser WASM OCR
 * so Check still sees titles, millimetres, and schedules.
 */
export async function extractPdf(
  filename: string,
  bytes: Uint8Array | ArrayBuffer,
  options: ExtractPdfOptions = {},
): Promise<DrawingExtract> {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const data = new Uint8Array(source);
  const maxEntities = options.maxEntities ?? MAX_PAGE_PATHS;
  const startedAt = Date.now();
  options.onProgress?.({ page: 0, total: 0, startedAt });
  const pdf = await getDocumentProxy(data);
  const { totalPages, items } = await extractTextItems(pdf);
  options.onProgress?.({ page: 0, total: totalPages, startedAt });
  const sheets: DrawingSheet[] = [];
  const texts: DrawingText[] = [];
  const strings: string[] = [];
  const geometry: GeomEntity[] = [];
  const entityCounts: Record<string, number> = { PAGE: totalPages };
  let usedOcr = false;
  let ocr: OcrSession | null = null;

  for (let page = 0; page < totalPages; page += 1) {
    options.onProgress?.({ page: page + 1, total: totalPages, startedAt });
    let lines = reconstructPdfLines(items[page] ?? []);
    let pageGeometry: GeomEntity[] = [];
    let width = 0;
    let height = 0;
    try {
      const paths = await extractPagePaths(pdf, page + 1, maxEntities);
      pageGeometry = paths.geometry;
      width = paths.width;
      height = paths.height;
    } catch {
      pageGeometry = [];
    }
    if (!width || !height) {
      try {
        const pdfPage = await pdf.getPage(page + 1);
        const viewport = pdfPage.getViewport({ scale: 1 });
        width = viewport.width;
        height = viewport.height;
      } catch {
        width = 595.28;
        height = 841.89;
      }
    }
    const rasterNotes = pageNeedsOcr(lines) || (await pageHasLargeRaster(pdf, page + 1));
    if (rasterNotes) {
      options.onProgress?.({ page: page + 1, total: totalPages, startedAt, ocr: true });
      try {
        ocr ??= await createOcrSession();
        const { image, scale } = await rasterPdfPage(pdf, page + 1, width, height);
        const ocrLines = linesFromOcr(await ocr.recognize(image), scale, height);
        if (ocrLines.length) {
          lines = [...lines, ...ocrLines];
          usedOcr = true;
          entityCounts.OCR = (entityCounts.OCR ?? 0) + ocrLines.length;
        }
      } catch {
        // Vector text (if any) still feeds Check. OCR is best-effort.
      }
    }
    const pageTexts: DrawingText[] = lines.map((line) => ({
      kind: "text" as const,
      value: line.value,
      x: line.x,
      y: line.y,
      height: line.height,
      width: line.width,
    }));
    const pageStrings = uniqueLines(pageTexts.map((item) => item.value));
    for (const line of lines) {
      pageGeometry.push({
        kind: "text",
        p: { x: line.x, y: line.y },
        height: line.height || 12,
        width: line.width,
        value: line.value,
      });
    }
    for (const entity of pageGeometry) {
      const kind = entity.kind.toUpperCase();
      entityCounts[kind] = (entityCounts[kind] ?? 0) + 1;
    }
    entityCounts.TEXT = (entityCounts.TEXT ?? 0) + pageTexts.length;
    sheets.push({
      name: nameSheet(pageStrings, page),
      geometry: pageGeometry,
      texts: pageTexts,
      strings: pageStrings,
      width,
      height,
    });
    texts.push(...pageTexts);
    strings.push(...pageStrings);
    geometry.push(...pageGeometry);
    await yieldToUi();
  }

  if (ocr) {
    await ocr.terminate().catch(() => undefined);
  }

  void filename;
  const first = sheets[0];
  const extract: DrawingExtract = {
    format: "pdf",
    texts,
    strings: uniqueLines(strings),
    entityCounts,
    geometry,
    sheets,
    pageWidth: first?.width,
    pageHeight: first?.height,
    ocr: usedOcr,
  };
  try {
    await pdf.cleanup();
    await pdf.loadingTask.destroy();
  } catch {
    // Document already torn down.
  }
  return extract;
}

export function nameSheet(strings: string[], index: number) {
  const titled = strings.find((line) => {
    const trimmed = line.trim();
    return trimmed.length >= 8 && trimmed.length <= 72 && SHEET_TITLE.test(trimmed);
  });
  return titled ? `Sheet ${index + 1} · ${titled.trim()}` : `Sheet ${index + 1}`;
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}
