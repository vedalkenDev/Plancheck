import type { GeomEntity, Point } from "@/lib/cad/extract";
import { getDocumentProxy, getResolvedPDFJS } from "unpdf";

type PdfDoc = Awaited<ReturnType<typeof getDocumentProxy>>;

const DRAW = {
  moveTo: 0,
  lineTo: 1,
  curveTo: 2,
  quadraticCurveTo: 3,
  closePath: 4,
};

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export const MAX_PAGE_PATHS = 1200;

/** Walk pdf.js constructPath ops so wall geometry is on the extract, not just labels. */
export async function extractPagePaths(
  pdf: PdfDoc,
  pageNumber: number,
  maxEntities = MAX_PAGE_PATHS,
): Promise<{ geometry: GeomEntity[]; width: number; height: number }> {
  const pdfjs = await getResolvedPDFJS();
  const ops = pdfjs.OPS;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const list = await page.getOperatorList();
  const geometry: GeomEntity[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;

  for (let i = 0; i < list.fnArray.length; i += 1) {
    if (geometry.length >= maxEntities) {
      break;
    }
    const fn = list.fnArray[i];
    const args = list.argsArray[i] as unknown[];
    if (fn === ops.save) {
      stack.push(ctm);
      continue;
    }
    if (fn === ops.restore) {
      ctm = stack.pop() ?? IDENTITY;
      continue;
    }
    if (fn === ops.transform) {
      ctm = multiply(ctm, asMatrix(args));
      continue;
    }
    if (fn === ops.paintFormXObjectBegin) {
      stack.push(ctm);
      ctm = multiply(ctm, asMatrix(args));
      continue;
    }
    if (fn === ops.paintFormXObjectEnd) {
      ctm = stack.pop() ?? IDENTITY;
      continue;
    }
    if (fn !== ops.constructPath) {
      continue;
    }
    const consume = Number(args[0]);
    if (
      consume === ops.clip ||
      consume === ops.eoClip ||
      consume === ops.endPath
    ) {
      continue;
    }
    const packed = firstPacked(args[1]);
    if (!packed) {
      continue;
    }
    const shapes = decodePath(packed, ctm);
    const fill = consume === ops.fill || consume === ops.eoFill || consume === ops.fillStroke;
    const stroke =
      consume === ops.stroke ||
      consume === ops.closeStroke ||
      consume === ops.fillStroke ||
      consume === ops.eoFillStroke;
    for (const shape of shapes) {
      if (pageSized(shape, viewport.width, viewport.height)) {
        continue;
      }
      if (shape.kind === "polyline") {
        geometry.push({
          ...shape,
          ...(fill && shape.closed ? { fill: true } : {}),
        });
        continue;
      }
      if (stroke || fill) {
        geometry.push(shape);
      }
    }
  }

  return { geometry, width: viewport.width, height: viewport.height };
}

function firstPacked(value: unknown): ArrayLike<number> | null {
  if (Array.isArray(value) && value[0] && typeof value[0] === "object") {
    return value[0] as ArrayLike<number>;
  }
  if (value && typeof value === "object" && "length" in (value as object)) {
    return value as ArrayLike<number>;
  }
  return null;
}

function decodePath(packed: ArrayLike<number>, ctm: Matrix): GeomEntity[] {
  const out: GeomEntity[] = [];
  const points: Point[] = [];
  let closed = false;
  let i = 0;

  const flush = () => {
    if (points.length >= 2) {
      out.push({
        kind: "polyline",
        closed,
        points: points.map((point) => apply(ctm, point.x, point.y)),
      });
    }
    points.length = 0;
    closed = false;
  };

  while (i < packed.length) {
    const op = packed[i];
    if (op === DRAW.moveTo) {
      flush();
      points.push({ x: packed[i + 1], y: packed[i + 2] });
      i += 3;
      continue;
    }
    if (op === DRAW.lineTo) {
      points.push({ x: packed[i + 1], y: packed[i + 2] });
      i += 3;
      continue;
    }
    if (op === DRAW.curveTo) {
      const from = points[points.length - 1] ?? { x: packed[i + 5], y: packed[i + 6] };
      points.push(
        ...sampleCubic(
          from,
          { x: packed[i + 1], y: packed[i + 2] },
          { x: packed[i + 3], y: packed[i + 4] },
          { x: packed[i + 5], y: packed[i + 6] },
        ),
      );
      i += 7;
      continue;
    }
    if (op === DRAW.quadraticCurveTo) {
      const from = points[points.length - 1] ?? { x: packed[i + 3], y: packed[i + 4] };
      points.push(
        ...sampleQuadratic(from, { x: packed[i + 1], y: packed[i + 2] }, { x: packed[i + 3], y: packed[i + 4] }),
      );
      i += 5;
      continue;
    }
    if (op === DRAW.closePath) {
      closed = true;
      i += 1;
      flush();
      continue;
    }
    i += 1;
  }
  flush();
  return out;
}

function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point) {
  const points: Point[] = [];
  for (let step = 1; step <= 6; step += 1) {
    const t = step / 6;
    const u = 1 - t;
    points.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return points;
}

function sampleQuadratic(p0: Point, p1: Point, p2: Point) {
  const points: Point[] = [];
  for (let step = 1; step <= 5; step += 1) {
    const t = step / 5;
    const u = 1 - t;
    points.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
  return points;
}

function pageSized(shape: GeomEntity, width: number, height: number) {
  const box = bounds(shape);
  if (!box) {
    return false;
  }
  return box.w > width * 0.85 && box.h > height * 0.85;
}

function bounds(shape: GeomEntity) {
  const pts =
    shape.kind === "polyline"
      ? shape.points
      : shape.kind === "line"
        ? [shape.a, shape.b]
        : [];
  if (pts.length < 2) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of pts) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { w: maxX - minX, h: maxY - minY };
}

function asMatrix(args: unknown[]): Matrix {
  const raw = (Array.isArray(args[0]) ? args[0] : args) as ArrayLike<number>;
  return [num(raw[0], 1), num(raw[1], 0), num(raw[2], 0), num(raw[3], 1), num(raw[4], 0), num(raw[5], 0)];
}

function num(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function apply(m: Matrix, x: number, y: number): Point {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}
