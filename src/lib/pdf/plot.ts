import type { DrawingExtract, GeomEntity, Point } from "@/lib/cad/extract";
import { geometryBounds } from "@/lib/cad/preview";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A3_LANDSCAPE: [number, number] = [1190.55, 841.89];
const INK = rgb(0.12, 0.11, 0.1);

type PlotOptions = {
  splitGlyphs?: boolean;
  pageSize?: [number, number];
};

/** Plot a drawing extract as a vector PDF — the same thing a CAD layout plot would ship. */
export async function plotDrawingPdf(extract: DrawingExtract, options: PlotOptions = {}) {
  const pdf = await PDFDocument.create();
  const pageSize = options.pageSize ?? A3_LANDSCAPE;
  const page = pdf.addPage(pageSize);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bounds = sheetBounds(extract.geometry);
  const margin = 36;
  const boxW = Math.max(bounds.maxX - bounds.minX, 1);
  const boxH = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min((pageSize[0] - margin * 2) / boxW, (pageSize[1] - margin * 2) / boxH);
  const map = (point: Point): Point => ({
    x: margin + (point.x - bounds.minX) * scale,
    y: margin + (point.y - bounds.minY) * scale,
  });

  const linework: string[] = [];
  const texts: GeomEntity[] = [];
  for (const entity of extract.geometry) {
    if (entity.kind === "text") {
      texts.push(entity);
      continue;
    }
    linework.push(svgOf(entity, map, scale));
  }
  const path = linework.filter(Boolean).join(" ");
  if (path) {
    page.drawSvgPath(path, {
      borderColor: INK,
      borderWidth: 0.7,
    });
  }
  for (const entity of texts) {
    if (entity.kind !== "text") {
      continue;
    }
    const at = map(entity.p);
    const size = Math.min(16, Math.max(5, entity.height * scale));
    const value = winAnsi(entity.value);
    if (!value) {
      continue;
    }
    if (options.splitGlyphs) {
      let x = at.x;
      for (const ch of value) {
        page.drawText(ch, { x, y: at.y, size, font, color: INK });
        x += font.widthOfTextAtSize(ch, size);
      }
      continue;
    }
    page.drawText(value, { x: at.x, y: at.y, size, font, color: INK });
  }

  return pdf.save();
}

function svgOf(entity: GeomEntity, map: (point: Point) => Point, scale: number) {
  if (entity.kind === "line") {
    const a = map(entity.a);
    const b = map(entity.b);
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  if (entity.kind === "polyline") {
    const points = entity.points.map(map);
    if (points.length < 2) {
      return "";
    }
    const d = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    return entity.closed ? `${d} Z` : d;
  }
  if (entity.kind === "circle") {
    const c = map(entity.c);
    const r = Math.max(entity.r * scale, 0.4);
    return `M ${c.x - r} ${c.y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  if (entity.kind === "arc") {
    const points = sampleArc(entity.c, entity.r, entity.start, entity.end).map(map);
    if (points.length < 2) {
      return "";
    }
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }
  return "";
}

function sampleArc(center: Point, radius: number, startDeg: number, endDeg: number) {
  let sweep = endDeg - startDeg;
  while (sweep <= 0) {
    sweep += 360;
  }
  const steps = Math.max(8, Math.ceil(sweep / 12));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = ((startDeg + (sweep * i) / steps) * Math.PI) / 180;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return points;
}

function sheetBounds(geometry: GeomEntity[]) {
  const plan = geometryBounds(geometry);
  const notes = textBounds(geometry);
  if (plan && notes) {
    return {
      minX: Math.min(plan.minX, notes.minX),
      minY: Math.min(plan.minY, notes.minY),
      maxX: Math.max(plan.maxX, notes.maxX),
      maxY: Math.max(plan.maxY, notes.maxY),
    };
  }
  return plan ?? notes ?? { minX: 0, minY: 0, maxX: 1000, maxY: 700 };
}

function winAnsi(value: string) {
  return [...value].filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127).join("");
}

function textBounds(geometry: GeomEntity[]) {
  const points = geometry.flatMap((entity) => (entity.kind === "text" ? [entity.p] : []));
  if (!points.length) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX: maxX + 80, maxY: maxY + 20 };
}
