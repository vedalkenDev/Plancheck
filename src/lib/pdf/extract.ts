import type { DrawingExtract, DrawingSheet, DrawingText, GeomEntity } from "@/lib/cad/extract";
import { extractPagePaths, MAX_PAGE_PATHS } from "@/lib/pdf/paths";
import { reconstructPdfLines, uniqueLines } from "@/lib/pdf/text";
import { extractTextItems, getDocumentProxy } from "unpdf";

export type ExtractPhase = "text" | "paths";

export type ExtractProgress = {
  page: number;
  total: number;
  startedAt?: number;
  phase?: ExtractPhase;
};

export type ExtractPdfOptions = {
  onProgress?: (info: ExtractProgress) => void;
  /** Fires after every sheet has notes, before wall paths. Checklist can run now. */
  onText?: (extract: DrawingExtract) => void;
  maxEntities?: number;
  /** Default `auto`: skip wall paths on notes-only sheets. */
  paths?: boolean | "auto";
};

const SHEET_TITLE =
  /proposed|window schedule|\bschedule\b|elevation|section|layout|(?:site|floor|roof)\s*plan|title\s*block/i;

const DRAWING_SHEET =
  /(?:site|floor|roof|drainage|fire)\s*plans?|floorplan|\belevations?\b|\bsections?\b/i;

const ROOM_LABEL =
  /\b(?:bed\s*rooms?|kitchen|lounge|gallery|dining(?:\s*room)?|study|bath(?:room)?s?|garage|terrace|porch|breezeway|passage|courtyard|scullery|laundry|lobby|hallway|living(?:\s*room)?|dressing(?:\s*room)?)\b/gi;

const NOTES_SHEET =
  /\boccupancy\s*[a-hj]\d?|fenestration|sans\s*10\d{3}|nett\s*floor|part\s*[rdmt]\b/i;

/**
 * Audit reads notes. Wall paths are only for packing stamps off a plan.
 * Skip `getOperatorList` on occupancy/XA sheets — that walk is the slow part.
 * Bare "PLAN" in a titleblock is not a floor plan.
 */
export function sheetNeedsPaths(strings: string[]): boolean {
  const blob = strings.join("\n");
  if (DRAWING_SHEET.test(blob)) {
    return true;
  }
  const rooms = blob.match(ROOM_LABEL);
  if (rooms && rooms.length >= 3) {
    return true;
  }
  if (NOTES_SHEET.test(blob)) {
    return false;
  }
  return true;
}

/**
 * Council packs are PDF. The current SANS rules read notes, schedules, and
 * percentages printed on the sheet — the same strings a CAD plot puts in a
 * vector PDF. Scanned sheets with no text still fail the readable-text check.
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
  options.onProgress?.({ page: 0, total: 0, startedAt, phase: "text" });
  const pdf = await getDocumentProxy(data);
  const { totalPages, items } = await extractTextItems(pdf);
  options.onProgress?.({ page: 0, total: totalPages, startedAt, phase: "text" });
  const sheets: DrawingSheet[] = [];
  const pending: number[] = [];

  for (let page = 0; page < totalPages; page += 1) {
    options.onProgress?.({
      page: page + 1,
      total: totalPages,
      startedAt,
      phase: "text",
    });
    const lines = reconstructPdfLines(items[page] ?? []);
    const pageTexts: DrawingText[] = lines.map((line) => ({
      kind: "text" as const,
      value: line.value,
    }));
    const pageStrings = uniqueLines(pageTexts.map((item) => item.value));
    const size = await pageSize(pdf, page + 1);
    const pageGeometry: GeomEntity[] = lines.map((line) => ({
      kind: "text" as const,
      p: { x: line.x, y: line.y },
      height: line.height || 12,
      width: line.width,
      value: line.value,
    }));
    const wantPaths =
      options.paths === true ||
      (options.paths !== false && sheetNeedsPaths(pageStrings));
    if (wantPaths) {
      pending.push(page + 1);
    }
    sheets.push({
      name: nameSheet(pageStrings, page),
      geometry: pageGeometry,
      texts: pageTexts,
      strings: pageStrings,
      width: size.width,
      height: size.height,
    });
    await yieldToUi();
  }

  if (pending.length && options.onText) {
    options.onText(snapshot(sheets, totalPages));
    await yieldToUi();
  }

  for (let index = 0; index < pending.length; index += 1) {
    const pageNumber = pending[index];
    const sheet = pageNumber ? sheets[pageNumber - 1] : undefined;
    if (!pageNumber || !sheet) {
      continue;
    }
    options.onProgress?.({
      page: index + 1,
      total: pending.length,
      startedAt,
      phase: "paths",
    });
    try {
      const paths = await extractPagePaths(pdf, pageNumber, maxEntities);
      sheet.geometry = [...paths.geometry, ...sheet.geometry];
      if (paths.width) {
        sheet.width = paths.width;
      }
      if (paths.height) {
        sheet.height = paths.height;
      }
    } catch {
      // Text extract still stands.
    }
    await yieldToUi();
  }

  void filename;
  const extract = snapshot(sheets, totalPages);
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

function snapshot(sheets: DrawingSheet[], totalPages: number): DrawingExtract {
  const copied = sheets.map((sheet) => ({
    ...sheet,
    geometry: [...sheet.geometry],
    texts: [...sheet.texts],
    strings: [...sheet.strings],
  }));
  const texts = copied.flatMap((sheet) => sheet.texts);
  const strings = uniqueLines(copied.flatMap((sheet) => sheet.strings));
  const geometry = copied.flatMap((sheet) => sheet.geometry);
  const entityCounts: Record<string, number> = { PAGE: totalPages };
  for (const sheet of copied) {
    for (const entity of sheet.geometry) {
      const kind = entity.kind.toUpperCase();
      entityCounts[kind] = (entityCounts[kind] ?? 0) + 1;
    }
    entityCounts.TEXT = (entityCounts.TEXT ?? 0) + sheet.texts.length;
  }
  const first = copied[0];
  return {
    format: "pdf",
    texts,
    strings,
    entityCounts,
    geometry,
    sheets: copied,
    pageWidth: first?.width,
    pageHeight: first?.height,
  };
}

async function pageSize(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  pageNumber: number,
) {
  try {
    const pdfPage = await pdf.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 1 });
    return { width: viewport.width, height: viewport.height };
  } catch {
    return { width: 595.28, height: 841.89 };
  }
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}
