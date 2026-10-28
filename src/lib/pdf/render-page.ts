import { getDocumentProxy } from "unpdf";

export type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

const MAX_EDGE = 3600;

export async function openPdfDocument(bytes: ArrayBuffer | Uint8Array): Promise<PdfDocument> {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return getDocumentProxy(source.slice());
}

export async function renderPdfPage(
  pdf: PdfDocument,
  pageNumber: number,
): Promise<{ url: string; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, MAX_EDGE / Math.max(base.width, base.height, 1));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("The drawing surface could not be created.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({
    canvasContext: context,
    canvas,
    viewport,
  }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => {
      if (next) {
        resolve(next);
        return;
      }
      reject(new Error("The sheet could not be drawn."));
    }, "image/png");
  });
  return {
    url: URL.createObjectURL(blob),
    width: base.width,
    height: base.height,
  };
}
