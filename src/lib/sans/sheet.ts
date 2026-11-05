import type { DrawingExtract, GeomEntity, Point } from "@/lib/cad/extract";
import { parseWindowUnits, type WindowUnit } from "@/lib/sans/fenestration";
import { MAX_RISER_MM, MIN_GOING_MM, readStairs, type StairReading } from "@/lib/sans/stairs";

/** PDF user space → millimetres on the plotted sheet. */
export const PT_TO_MM = 25.4 / 72;

/** Plot scales at or above this are used to convert stroke lengths. 1:1 is CAD units, not paper. */
const PLOT_SCALE_MIN = 20;

export type SheetText = {
  value: string;
  x: number;
  y: number;
  height: number;
  width: number;
};

export type SheetScale = {
  ratio: number;
  quote: string;
};

export type SheetDim = {
  mm: number;
  quote: string;
  x: number;
  y: number;
  pairMm?: number;
};

export type SheetStairs = StairReading & {
  source: "label" | "dimension" | "plotted";
};

export type SheetMeasure = {
  scale?: SheetScale;
  dims: SheetDim[];
  stairs: SheetStairs;
  windows: WindowUnit[];
  siteAreaM2?: { value: number; quote: string };
  coveragePct?: { value: number; quote: string };
  parking?: { quote: string; provided?: number; required?: number };
  lightingWm2?: { value: number; quote: string };
  poolBarrierMm?: { value: number; quote: string };
};

const SKIP_DIM_LINE =
  /occupancy|fenestr|nett\s*floor|w\s*\/\s*m|parking|coverage|signature|proposed|erf\b|site\s*area|scale\s*1|titleblock|\d+\s+[A-Za-z].*(?:Road|Rd|Drive|Dr|Street|St|Avenue|Ave|Lane|Ln|Way|Crescent|Close)\b/i;
const STOREY = /(L\/G|Lower\s*ground|Ground|First|Second|LG)\b/i;

export function readSheet(extract: DrawingExtract): SheetMeasure {
  const blob = extract.strings.join("\n");
  const texts = positionedTexts(extract);
  const scale = readScale(extract.strings);
  const dims = collectDims(texts);
  return {
    scale,
    dims,
    stairs: stairsFromSheet(texts, dims, readStairs(blob), scale, extract.geometry),
    windows: windowsFromSheet(texts, dims, blob),
    siteAreaM2: readSiteArea(blob),
    coveragePct: readCoveragePct(blob),
    parking: readParking(blob),
    lightingWm2: readLighting(blob),
    poolBarrierMm: readPoolBarrier(texts, dims, blob),
  };
}

export function positionedTexts(extract: DrawingExtract): SheetText[] {
  const fromGeom = extract.geometry.flatMap((entity) =>
    entity.kind === "text" && entity.value.trim()
      ? [
          {
            value: entity.value.replace(/\s+/g, " ").trim(),
            x: entity.p.x,
            y: entity.p.y,
            height: entity.height || 12,
            width: entity.width ?? Math.max(entity.value.length, 1) * (entity.height || 12) * 0.6,
          },
        ]
      : [],
  );
  if (fromGeom.length) {
    return fromGeom;
  }
  return extract.texts.flatMap((item, index) =>
    item.value.trim()
      ? [
          {
            value: item.value.replace(/\s+/g, " ").trim(),
            x: item.x ?? 0,
            y: item.y ?? index * 14,
            height: item.height || 12,
            width: item.width ?? item.value.length * 7,
          },
        ]
      : [],
  );
}

export function readScale(strings: string[]): SheetScale | undefined {
  for (const line of strings) {
    const named = line.match(/scale\s*[:\s]*1\s*[:/]\s*(\d+)/i);
    if (named) {
      const ratio = Number.parseInt(named[1], 10);
      if (ratio > 0) {
        return { ratio, quote: line.replace(/\s+/g, " ").trim() };
      }
    }
    const bare = line.match(/\b1\s*[:/]\s*(20|25|50|75|100|200|250|500|1000)\b/);
    if (bare) {
      return { ratio: Number.parseInt(bare[1], 10), quote: line.replace(/\s+/g, " ").trim() };
    }
  }
  return undefined;
}

export function collectDims(texts: SheetText[]): SheetDim[] {
  const out: SheetDim[] = [];
  for (const text of texts) {
    if (SKIP_DIM_LINE.test(text.value) && !/\d+\s*[x×]\s*\d+/.test(text.value)) {
      continue;
    }
    const expanded = expandRepeatedDigits(text.value);
    for (const match of expanded.matchAll(
      /(\d+(?:\.\d+)?)\s*(mm|m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|m)?/gi,
    )) {
      const width = toMm(Number.parseFloat(match[1]), match[2]);
      const height = toMm(Number.parseFloat(match[3]), match[4]);
      if (width !== undefined && height !== undefined && isOpeningSize(width, height)) {
        out.push({
          mm: width,
          pairMm: height,
          quote: match[0].replace(/\s+/g, " ").trim(),
          x: text.x,
          y: text.y,
        });
      }
    }
    for (const match of expanded.matchAll(/(\d+(?:\.\d+)?)\s*(mm|m)\b(?!\s*2)/gi)) {
      const mm = toMm(Number.parseFloat(match[1]), match[2]);
      if (mm !== undefined) {
        out.push({
          mm,
          quote: match[0].replace(/\s+/g, " ").trim(),
          x: text.x,
          y: text.y,
        });
      }
    }
    if (!/\bmm\b|\bm2\b|\bm²\b|%/i.test(expanded)) {
      for (const match of expanded.matchAll(/\b(\d{3,5})\b/g)) {
        const mm = Number.parseInt(match[1], 10);
        if (mm >= 80 && mm <= 30000) {
          out.push({ mm, quote: match[1], x: text.x, y: text.y });
        }
      }
    }
  }
  return uniqueDims(out);
}

export function plottedMm(lengthPt: number, scale: SheetScale) {
  if (scale.ratio < PLOT_SCALE_MIN) {
    return undefined;
  }
  return Math.round(lengthPt * PT_TO_MM * scale.ratio);
}

function stairsFromSheet(
  texts: SheetText[],
  dims: SheetDim[],
  labeled: StairReading,
  scale: SheetScale | undefined,
  geometry: GeomEntity[],
): SheetStairs {
  if (labeled.riserMm !== undefined && labeled.goingMm !== undefined) {
    return { ...labeled, source: "label" };
  }

  const labels = texts.filter((text) => /stair|riser|going|tread/i.test(text.value));
  let riserMm = labeled.riserMm;
  let goingMm = labeled.goingMm;

  for (const label of labels) {
    const nearby = dims
      .filter((dim) => dim.mm >= 80 && dim.mm <= 400 && dist(dim, label) < 110)
      .sort((a, b) => dist(a, label) - dist(b, label));
    const pick = nearby[0];
    if (!pick) {
      continue;
    }
    const name = label.value.toLowerCase();
    if (/riser/.test(name) && riserMm === undefined) {
      riserMm = pick.mm;
    }
    if (/(going|tread)/.test(name) && goingMm === undefined) {
      goingMm = pick.mm;
    }
  }

  if ((riserMm === undefined || goingMm === undefined) && labels.length) {
    const sizes = [
      ...new Set(
        dims
          .filter((dim) => dim.mm >= 80 && dim.mm <= 400 && labels.some((label) => dist(dim, label) < 130))
          .map((dim) => dim.mm),
      ),
    ].sort((a, b) => a - b);
    if (riserMm === undefined) {
      riserMm = sizes.find((size) => size <= MAX_RISER_MM);
    }
    if (goingMm === undefined) {
      goingMm = sizes.find((size) => size >= MIN_GOING_MM);
    }
    if (riserMm === undefined && goingMm === undefined && sizes.length >= 2) {
      const small = sizes[0];
      const large = sizes[sizes.length - 1];
      if (small <= 220 && large >= 220) {
        riserMm = small;
        goingMm = large;
      }
    }
  }

  if (riserMm !== undefined || goingMm !== undefined) {
    const fromLabel = labeled.riserMm !== undefined || labeled.goingMm !== undefined;
    return { riserMm, goingMm, source: fromLabel ? "label" : "dimension" };
  }

  const plotted = scale ? goingFromPlot(geometry, scale) : undefined;
  if (plotted !== undefined) {
    return { goingMm: plotted, source: "plotted" };
  }

  return { ...labeled, source: "label" };
}

function windowsFromSheet(texts: SheetText[], dims: SheetDim[], blob: string): WindowUnit[] {
  const printed = parseWindowUnits(blob);
  if (printed.length) {
    return printed;
  }
  const units: WindowUnit[] = [];
  const tags = texts.filter((text) => /\bW\d{1,2}\b/i.test(text.value));
  for (const tag of tags) {
    const match = tag.value.match(/\bW(\d{1,2})\b/i);
    if (!match) {
      continue;
    }
    const type = `W${match[1]}`;
    const pair = dims
      .filter((dim) => dim.pairMm && isOpeningSize(dim.mm, dim.pairMm) && dist(dim, tag) < 150)
      .sort((a, b) => dist(a, tag) - dist(b, tag))[0];
    if (pair?.pairMm) {
      units.push({
        type,
        widthM: round2(pair.mm / 1000),
        heightM: round2(pair.pairMm / 1000),
        qty: 1,
        storey: storeyNear(texts, tag),
        quote: `${type} ${pair.quote}`,
      });
      continue;
    }
    const singles = dims
      .filter((dim) => !dim.pairMm && dim.mm >= 300 && dim.mm <= 4500 && dist(dim, tag) < 150)
      .sort((a, b) => dist(a, tag) - dist(b, tag));
    if (singles.length >= 2) {
      units.push({
        type,
        widthM: round2(singles[0].mm / 1000),
        heightM: round2(singles[1].mm / 1000),
        qty: 1,
        storey: storeyNear(texts, tag),
        quote: `${type} ${singles[0].mm} x ${singles[1].mm}`,
      });
    }
  }
  return uniqueWindowUnits(units);
}

function goingFromPlot(geometry: GeomEntity[], scale: SheetScale) {
  if (scale.ratio < PLOT_SCALE_MIN) {
    return undefined;
  }
  const segs = segmentsOf(geometry).filter((seg) => seg.len > 4);
  if (segs.length < 6) {
    return undefined;
  }
  const buckets = new Map<number, number>();
  for (let i = 0; i < segs.length; i += 1) {
    const a = segs[i];
    for (let j = i + 1; j < segs.length; j += 1) {
      const b = segs[j];
      if (!parallel(a.ang, b.ang)) {
        continue;
      }
      const gap = Math.abs(offset(a, b));
      const mm = plottedMm(gap, scale);
      if (mm === undefined || mm < MIN_GOING_MM - 20 || mm > 360) {
        continue;
      }
      const key = Math.round(mm / 5) * 5;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  let best: { mm: number; n: number } | undefined;
  for (const [mm, n] of buckets) {
    if (n >= 3 && (!best || n > best.n)) {
      best = { mm, n };
    }
  }
  return best?.mm;
}

function readSiteArea(blob: string) {
  const match = blob.match(/site\s*area[^\n]{0,32}?(\d+(?:\.\d+)?)\s*m(?:2|²)?/i);
  if (!match) {
    return undefined;
  }
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return { value, quote: match[0].replace(/\s+/g, " ").trim() };
}

function readCoveragePct(blob: string) {
  const match = blob.match(/coverage[^\n]{0,40}?(\d+(?:\.\d+)?)\s*%/i);
  if (!match) {
    return undefined;
  }
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return { value, quote: match[0].replace(/\s+/g, " ").trim() };
}

function readParking(blob: string) {
  const match = blob.match(/parking[^\n]{0,48}/i);
  if (!match) {
    return undefined;
  }
  const quote = match[0].replace(/\s+/g, " ").trim();
  const vs = quote.match(/(\d+)\s*(?:\/|provided\s*vs)\s*(\d+)/i);
  if (vs) {
    return {
      quote,
      provided: Number.parseInt(vs[1], 10),
      required: Number.parseInt(vs[2], 10),
    };
  }
  const one = quote.match(/(\d+)/);
  if (!one) {
    return undefined;
  }
  return { quote, provided: Number.parseInt(one[1], 10) };
}

function readLighting(blob: string) {
  const match = blob.match(/(\d+(?:\.\d+)?)\s*w\s*\/\s*m/i);
  if (!match) {
    return undefined;
  }
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return { value, quote: match[0].replace(/\s+/g, " ").trim() };
}

function readPoolBarrier(texts: SheetText[], dims: SheetDim[], blob: string) {
  if (!/pool|swimming/i.test(blob)) {
    return undefined;
  }
  const labels = texts.filter((text) => /pool|swimming|enclos|fence|barrier|gate/i.test(text.value));
  const nearby = dims.filter(
    (dim) =>
      (dim.mm === 1200 || dim.mm === 100 || Math.abs(dim.mm - 1200) <= 5) &&
      labels.some((label) => dist(dim, label) < 160),
  );
  const hit = nearby.find((dim) => dim.mm >= 1000) ?? nearby[0];
  if (hit) {
    return { value: hit.mm, quote: hit.quote };
  }
  const printed = blob.match(/1\s*[.,]?\s*2\s*m|1200\s*mm/i);
  if (printed) {
    return { value: 1200, quote: printed[0].replace(/\s+/g, " ").trim() };
  }
  return undefined;
}

export function expandRepeatedDigits(value: string) {
  return value.replace(/\d{6,}/g, (run) => {
    for (const size of [4, 3, 5]) {
      if (run.length % size !== 0 || run.length / size < 2) {
        continue;
      }
      const parts: string[] = [];
      for (let i = 0; i < run.length; i += size) {
        parts.push(run.slice(i, i + size));
      }
      if (parts.every((part) => {
        const n = Number.parseInt(part, 10);
        return n >= 80 && n <= 30000;
      })) {
        return parts.join(" ");
      }
    }
    return run;
  });
}

function storeyNear(texts: SheetText[], at: { x: number; y: number }) {
  const hit = texts.find((text) => STOREY.test(text.value) && dist(text, at) < 180);
  if (!hit) {
    return undefined;
  }
  const match = hit.value.match(STOREY);
  const value = match?.[1]?.toLowerCase() ?? "";
  if (value === "lg" || value.startsWith("lower") || value === "l/g") {
    return "L/G";
  }
  return match?.[1]?.replace(/^./, (char) => char.toUpperCase());
}

function toMm(value: number, unit: string | undefined) {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  if (unit?.toLowerCase() === "m") {
    const mm = value * 1000;
    return mm >= 80 && mm <= 50000 ? Math.round(mm) : undefined;
  }
  if (value >= 80 && value <= 50000) {
    return Math.round(value);
  }
  return undefined;
}

function isOpeningSize(width: number, height: number) {
  return width >= 300 && width <= 4500 && height >= 300 && height <= 4500;
}

function uniqueDims(dims: SheetDim[]) {
  const seen = new Set<string>();
  const out: SheetDim[] = [];
  for (const dim of dims) {
    const key = `${dim.quote}:${Math.round(dim.x)}:${Math.round(dim.y)}:${dim.mm}:${dim.pairMm ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(dim);
  }
  return out;
}

function uniqueWindowUnits(units: WindowUnit[]) {
  const seen = new Set<string>();
  const out: WindowUnit[] = [];
  for (const unit of units) {
    const key = `${unit.storey ?? ""}:${unit.type}:${unit.widthM}:${unit.heightM}:${unit.qty}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(unit);
  }
  return out;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

type Seg = { a: Point; b: Point; len: number; ang: number };

function segmentsOf(geometry: GeomEntity[]): Seg[] {
  const segs: Seg[] = [];
  const add = (a: Point, b: Point) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) {
      return;
    }
    segs.push({ a, b, len, ang: Math.atan2(b.y - a.y, b.x - a.x) });
  };
  for (const entity of geometry) {
    if (entity.kind === "line") {
      add(entity.a, entity.b);
    }
    if (entity.kind === "polyline") {
      for (let i = 1; i < entity.points.length; i += 1) {
        add(entity.points[i - 1], entity.points[i]);
      }
    }
  }
  return segs;
}

function parallel(a: number, b: number) {
  const delta = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  return delta < 0.12 || Math.abs(delta - Math.PI) < 0.12;
}

function offset(a: Seg, b: Seg) {
  const nx = -Math.sin(a.ang);
  const ny = Math.cos(a.ang);
  const mx = (b.a.x + b.b.x) / 2 - (a.a.x + a.b.x) / 2;
  const my = (b.a.y + b.b.y) / 2 - (a.a.y + a.b.y) / 2;
  return mx * nx + my * ny;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
