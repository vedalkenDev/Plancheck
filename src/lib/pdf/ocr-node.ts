import { renderPageAsImage, type getDocumentProxy } from "unpdf";

type PdfDoc = Awaited<ReturnType<typeof getDocumentProxy>>;

/** Node-only raster. Browser extract uses a DOM canvas instead. */
export async function rasterPdfPageNode(
  pdf: PdfDoc,
  pageNumber: number,
  scale: number,
): Promise<{ image: Buffer; scale: number }> {
  const png = await renderPageAsImage(pdf, pageNumber, {
    canvasImport: () => import("@napi-rs/canvas"),
    scale,
  });
  return { image: Buffer.from(png), scale };
}
