import type { DrawingExtract, DrawingSheet, DrawingText, GeomEntity } from "@/lib/cad/extract";
import { extractPagePaths } from "@/lib/pdf/paths";
import { reconstructPdfLines, uniqueLines } from "@/lib/pdf/text";
import { extractTextItems, getDocumentProxy } from "unpdf";

/**
 * Council packs are PDF. The current SANS rules read notes, schedules, and
 * percentages printed on the sheet — the same strings a CAD plot puts in a
 * vector PDF. Scanned sheets with no text still fail the readable-text check.
 */
export async function extractPdf(
  filename: string,
  bytes: Uint8Array | ArrayBuffer,
): Promise<DrawingExtract> {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const data = new Uint8Array(source);
  const pdf = await getDocumentProxy(data);
  const { totalPages, items } = await extractTextItems(pdf);
  const sheets: DrawingSheet[] = [];
  const texts: DrawingText[] = [];
  const strings: string[] = [];
  const geometry: GeomEntity[] = [];
  const entityCounts: Record<string, number> = { PAGE: totalPages };

  for (let page = 0; page < totalPages; page += 1) {
    const lines = reconstructPdfLines(items[page] ?? []);
    const pageTexts: DrawingText[] = lines.map((line) => ({ kind: "text" as const, value: line.value }));
    const pageStrings = uniqueLines(pageTexts.map((item) => item.value));
    let pageGeometry: GeomEntity[] = [];
    try {
      pageGeometry = await extractPagePaths(pdf, page + 1);
    } catch {
      pageGeometry = [];
    }
    for (const line of lines) {
      pageGeometry.push({
        kind: "text",
        p: { x: line.x, y: line.y },
        height: line.height || 12,
        value: line.value,
      });
    }
    for (const entity of pageGeometry) {
      const kind = entity.kind.toUpperCase();
      entityCounts[kind] = (entityCounts[kind] ?? 0) + 1;
    }
    entityCounts.TEXT = (entityCounts.TEXT ?? 0) + pageTexts.length;
    sheets.push({
      name: `Sheet ${page + 1}`,
      geometry: pageGeometry,
      texts: pageTexts,
      strings: pageStrings,
    });
    texts.push(...pageTexts);
    strings.push(...pageStrings);
    geometry.push(...pageGeometry);
  }

  void filename;
  return {
    format: "pdf",
    texts,
    strings: uniqueLines(strings),
    entityCounts,
    geometry,
    sheets,
  };
}
