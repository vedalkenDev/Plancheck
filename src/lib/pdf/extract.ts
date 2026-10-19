import type { DrawingExtract, DrawingSheet, DrawingText, GeomEntity } from "@/lib/cad/extract";
import { extractTextItems, getDocumentProxy } from "unpdf";

/**
 * Council packs are PDF. The current SANS rules read notes, schedules, and
 * percentages printed on the sheet — the same strings a CAD plot puts in a
 * vector PDF. Scanned sheets with no text still fail the readable-text check.
 */
export async function extractPdf(filename: string, bytes: ArrayBuffer): Promise<DrawingExtract> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, items } = await extractTextItems(pdf);
  const sheets: DrawingSheet[] = [];
  const texts: DrawingText[] = [];
  const strings: string[] = [];
  const geometry: GeomEntity[] = [];

  for (let page = 0; page < totalPages; page += 1) {
    const pageTexts: DrawingText[] = [];
    const pageStrings: string[] = [];
    const pageGeometry: GeomEntity[] = [];
    for (const item of items[page] ?? []) {
      const value = item.str.replace(/\s+/g, " ").trim();
      if (!value) {
        continue;
      }
      const text: DrawingText = { kind: "text", value };
      pageTexts.push(text);
      pageStrings.push(value);
      pageGeometry.push({
        kind: "text",
        p: { x: item.x, y: item.y },
        height: item.height || item.fontSize || 12,
        value,
      });
    }
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
    strings,
    entityCounts: { TEXT: texts.length, PAGE: totalPages },
    geometry,
    sheets,
  };
}
