import type { GeomEntity, Point } from "@/lib/cad/extract";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function geometryBounds(geometry: GeomEntity[]): Bounds | null {
  const linePoints = geometry.flatMap(linePointsOf);
  const framed = boundsOf(keepPlan(linePoints));
  const curves = geometry.flatMap((entity) => curvePoints(entity, framed));
  const points = framed ? [...linePointsInside(linePoints, framed), ...curves] : curves;
  return boundsOf(points.length ? points : linePoints);
}

function linePointsOf(entity: GeomEntity): Point[] {
  if (entity.kind === "line") {
    return [entity.a, entity.b];
  }
  if (entity.kind === "polyline") {
    return entity.points;
  }
  return [];
}

function curvePoints(entity: GeomEntity, frame: Bounds | null): Point[] {
  if (entity.kind !== "circle" && entity.kind !== "arc") {
    return [];
  }
  if (frame) {
    const span = Math.max(frame.maxX - frame.minX, frame.maxY - frame.minY, 1);
    const inside =
      entity.c.x >= frame.minX - span &&
      entity.c.x <= frame.maxX + span &&
      entity.c.y >= frame.minY - span &&
      entity.c.y <= frame.maxY + span;
    if (!inside || entity.r > span * 2) {
      return [];
    }
  }
  return [
    { x: entity.c.x - entity.r, y: entity.c.y - entity.r },
    { x: entity.c.x + entity.r, y: entity.c.y + entity.r },
  ];
}

function linePointsInside(points: Point[], frame: Bounds) {
  const span = Math.max(frame.maxX - frame.minX, frame.maxY - frame.minY, 1);
  return points.filter(
    (point) =>
      point.x >= frame.minX - span * 0.05 &&
      point.x <= frame.maxX + span * 0.05 &&
      point.y >= frame.minY - span * 0.05 &&
      point.y <= frame.maxY + span * 0.05,
  );
}

function keepPlan(points: Point[]) {
  let current = points;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = dropDistantSide(current);
    if (next.length === current.length) {
      return current;
    }
    current = next;
  }
  return current;
}

function dropDistantSide(points: Point[]) {
  if (points.length < 4) {
    return points;
  }
  const box = boundsOf(points);
  if (!box) {
    return points;
  }
  const xSpan = box.maxX - box.minX;
  const ySpan = box.maxY - box.minY;
  const axis: "x" | "y" = xSpan >= ySpan ? "x" : "y";
  const span = Math.max(xSpan, ySpan);
  const sorted = [...points].sort((a, b) => a[axis] - b[axis]);
  let gap = 0;
  let at = -1;
  for (let i = 1; i < sorted.length; i += 1) {
    const size = sorted[i][axis] - sorted[i - 1][axis];
    if (size > gap) {
      gap = size;
      at = i;
    }
  }
  if (at < 0 || gap < span * 0.35) {
    return points;
  }
  const left = sorted.slice(0, at);
  const right = sorted.slice(at);
  if (left.length * 2 >= points.length && right.length * 2 >= points.length) {
    return points;
  }
  const minority = left.length <= right.length ? left : right;
  const majority = left.length <= right.length ? right : left;
  if (minority.length > Math.max(2, majority.length * 0.15)) {
    return points;
  }
  return majority;
}

function boundsOf(points: Point[]): Bounds | null {
  if (!points.length) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      continue;
    }
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!Number.isFinite(minX)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  const start = (startDeg * Math.PI) / 180;
  const end = (endDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  let sweep = endDeg - startDeg;
  while (sweep < 0) {
    sweep += 360;
  }
  const large = sweep > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

const CHAR_WIDTH = 0.55;

export function wrapText(value: string, width: number | undefined, height: number) {
  const paragraphs = value.split("\n");
  const maxChars =
    width && width > 0 && height > 0 ? Math.max(1, Math.floor(width / (height * CHAR_WIDTH))) : 0;
  if (!maxChars) {
    return paragraphs.length ? paragraphs : [""];
  }
  return paragraphs.flatMap((paragraph) => wrapParagraph(paragraph, maxChars));
}

function wrapParagraph(paragraph: string, maxChars: number) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [""];
  }
  const lines: string[] = [];
  let line = "";
  const pushWord = (word: string) => {
    let rest = word;
    while (rest.length > maxChars) {
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    line = rest;
  };
  for (const word of words) {
    if (!line) {
      pushWord(word);
      continue;
    }
    if (line.length + 1 + word.length <= maxChars) {
      line = `${line} ${word}`;
      continue;
    }
    lines.push(line);
    pushWord(word);
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}
