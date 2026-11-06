export type WindowUnit = {
  type: string;
  widthM: number;
  heightM: number;
  qty: number;
  storey?: string;
  quote: string;
};

export type StoreyFenestration = {
  storey: string;
  printedPercent?: number;
  floorM2?: number;
  glazedM2?: number;
  measuredPercent?: number;
};

export type FenestrationReading = {
  units: WindowUnit[];
  storeys: StoreyFenestration[];
  glazedM2: number;
  measured: boolean;
};

const STOREY =
  /(L\/G|Lower\s*ground|Ground|First|Second|LG)\b/i;
const STOREY_HEADER =
  /^(L\/G|Lower\s*ground|Ground|First|Second|LG)\s*(?:floor|storey|windows?)?\.?:?\s*$/i;
const SIZE =
  /(\d+(?:\.\d+)?)\s*(mm|m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|m)?/i;
const WINDOW_TYPE = /\bW(\d{1,2})\b/gi;
const QTY_AFTER =
  /(?:[x×]\s*(\d{1,2})\b|\((\d{1,2})\)|qty\s*(\d{1,2})\b|(\d{1,2})\s*off\b)/i;

export function readFenestration(
  blob: string,
  extraUnits: WindowUnit[] = [],
): FenestrationReading {
  const units = uniqueUnits([...parseWindowUnits(blob), ...extraUnits]);
  const storeys = mergeStoreys(blob, units);
  const glazedM2 = round2(units.reduce((sum, unit) => sum + unitArea(unit), 0));
  return {
    units,
    storeys,
    glazedM2,
    measured: units.length > 0,
  };
}

export function parseWindowUnits(blob: string): WindowUnit[] {
  const lines = blob.split(/\n/);
  const units: WindowUnit[] = [];
  let currentStorey: string | undefined;
  let pendingType: string | undefined;
  let pendingQuote = "";

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) {
      continue;
    }

    const header = line.match(STOREY_HEADER);
    if (header) {
      currentStorey = normalizeStorey(header[1]);
      pendingType = undefined;
      continue;
    }

    const onLine = unitsOnLine(line, currentStorey);
    if (onLine.length) {
      units.push(...onLine);
      const named = onLine.find((unit) => unit.storey);
      if (named?.storey) {
        currentStorey = named.storey;
      }
      pendingType = undefined;
      continue;
    }

    const typeOnly = line.match(/^W(\d{1,2})$/i);
    if (typeOnly) {
      pendingType = `W${typeOnly[1]}`;
      pendingQuote = line;
      const storey = storeyIn(line);
      if (storey) {
        currentStorey = storey;
      }
      continue;
    }

    if (pendingType) {
      const size = line.match(SIZE);
      if (size) {
        const unit = fromSize(
          pendingType,
          size,
          line,
          storeyIn(line) ?? currentStorey,
          `${pendingQuote} ${line}`,
        );
        if (unit) {
          units.push(unit);
        }
        pendingType = undefined;
        continue;
      }
      pendingType = undefined;
    }
  }

  return uniqueUnits(units);
}

export function findWindowTypes(blob: string) {
  const found: string[] = [];
  for (const match of blob.matchAll(WINDOW_TYPE)) {
    const label = `W${match[1]}`;
    if (!found.includes(label)) {
      found.push(label);
    }
  }
  return found;
}

export function describeCut(row: StoreyFenestration) {
  const percent = row.measuredPercent ?? row.printedPercent;
  if (!row.floorM2 || percent === undefined || percent <= 15) {
    return "";
  }
  const cut = ((percent - 15) / 100) * row.floorM2;
  return `${cut.toFixed(2)} m² (${row.storey})`;
}

export function suggestGlazingCuts(row: StoreyFenestration, units: WindowUnit[]) {
  const percent = row.measuredPercent ?? row.printedPercent;
  if (!row.floorM2 || percent === undefined || percent <= 15) {
    return "";
  }

  const excess = ((percent - 15) / 100) * row.floorM2;
  const pool = units
    .filter((unit) => (unit.storey ?? row.storey) === row.storey)
    .map((unit) => ({ ...unit, left: unit.qty }));
  if (!pool.length) {
    return describeCut(row);
  }

  let remain = excess;
  const removed: { type: string; qty: number; widthM: number; heightM: number }[] = [];
  pool.sort((a, b) => unitArea(b) / b.qty - unitArea(a) / a.qty);

  for (const unit of pool) {
    const area = unitArea(unit) / unit.qty;
    while (unit.left > 0 && remain > 0.02) {
      unit.left -= 1;
      remain -= area;
      const prev = removed.find((item) => item.type === unit.type);
      if (prev) {
        prev.qty += 1;
      } else {
        removed.push({
          type: unit.type,
          qty: 1,
          widthM: unit.widthM,
          heightM: unit.heightM,
        });
      }
    }
  }

  if (!removed.length) {
    return describeCut(row);
  }

  const parts = removed.map(
    (item) =>
      `${item.qty} × ${item.type} (${item.widthM.toFixed(2)} × ${item.heightM.toFixed(2)} m) on ${row.storey}`,
  );
  if (remain > 0.05) {
    parts.push(`${remain.toFixed(2)} m² more on ${row.storey}`);
  }
  return parts.join(" and ");
}

export function normalizeStorey(value: string) {
  const text = value.replace(/\s+/g, " ").trim().toLowerCase();
  if (text === "lg" || text.startsWith("lower")) {
    return "L/G";
  }
  if (text === "l/g") {
    return "L/G";
  }
  return value.replace(/\s+/g, " ").replace(/^./, (char) => char.toUpperCase());
}

function mergeStoreys(blob: string, units: WindowUnit[]): StoreyFenestration[] {
  const byName = new Map<string, StoreyFenestration>();

  function row(storey: string) {
    const current = byName.get(storey) ?? { storey };
    byName.set(storey, current);
    return current;
  }

  for (const match of blob.matchAll(
    /(L\/G|Lower\s*ground|Ground|First|Second|LG)\D{0,28}(\d+(?:\.\d+)?)\s*%/gi,
  )) {
    const item = row(normalizeStorey(match[1]));
    item.printedPercent = Number.parseFloat(match[2]);
  }

  for (const item of byName.values()) {
    const floor = matchFloor(blob, item.storey);
    if (floor) {
      item.floorM2 = floor;
    }
  }

  const glazedByStorey = new Map<string, number>();
  for (const unit of units) {
    if (!unit.storey) {
      continue;
    }
    glazedByStorey.set(unit.storey, (glazedByStorey.get(unit.storey) ?? 0) + unitArea(unit));
  }

  for (const [storey, glazedM2] of glazedByStorey) {
    const item = row(storey);
    item.glazedM2 = round2(glazedM2);
    item.floorM2 = item.floorM2 ?? matchFloor(blob, storey);
    if (item.floorM2) {
      item.measuredPercent = round1((glazedM2 / item.floorM2) * 100);
    }
  }

  if (!byName.size && units.length) {
    byName.set("All", {
      storey: "All",
      glazedM2: round2(units.reduce((sum, unit) => sum + unitArea(unit), 0)),
    });
  }

  return [...byName.values()];
}

function matchFloor(blob: string, storey: string) {
  const aliases =
    storey === "L/G"
      ? "L\\/G|Lower\\s*ground|LG"
      : storey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = blob.match(
    new RegExp(`(?:${aliases})[^\\n]{0,48}?(\\d+(?:\\.\\d+)?)\\s*m`, "i"),
  );
  if (!match) {
    return undefined;
  }
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function unitsOnLine(line: string, currentStorey?: string): WindowUnit[] {
  const found: WindowUnit[] = [];
  const storey = storeyIn(line) ?? currentStorey;
  for (const match of line.matchAll(/\bW(\d{1,2})\b/gi)) {
    const type = `W${match[1]}`;
    const from = match.index ?? 0;
    const slice = line.slice(from);
    const size = slice.match(SIZE);
    if (!size || (size.index ?? 0) > 48) {
      continue;
    }
    const unit = fromSize(type, size, slice, storey, line);
    if (unit) {
      found.push(unit);
    }
  }
  return found;
}

function fromSize(
  type: string,
  size: RegExpMatchArray,
  slice: string,
  storey: string | undefined,
  quote: string,
): WindowUnit | null {
  const width = toMetres(Number.parseFloat(size[1]), size[2], Number.parseFloat(size[3]), size[4]);
  const height = toMetres(Number.parseFloat(size[3]), size[4], Number.parseFloat(size[1]), size[2]);
  if (width === null || height === null) {
    return null;
  }
  const after = slice.slice((size.index ?? 0) + size[0].length);
  const before = slice.slice(0, size.index ?? 0);
  const qty = qtyIn(after) ?? qtyIn(before) ?? 1;
  return {
    type,
    widthM: round2(width),
    heightM: round2(height),
    qty,
    storey,
    quote: quote.replace(/\s+/g, " ").trim(),
  };
}

function toMetres(
  value: number,
  unit: string | undefined,
  other: number,
  otherUnit: string | undefined,
) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const named = unit?.toLowerCase();
  const metres = named === "m" || (named !== "mm" && value <= 20 && (other <= 20 || otherUnit?.toLowerCase() === "m"));
  const asM = named === "mm" || !metres ? value / 1000 : value;
  if (asM < 0.3 || asM > 4.5) {
    return null;
  }
  return asM;
}

function qtyIn(text: string) {
  const match = text.match(QTY_AFTER);
  if (!match) {
    return undefined;
  }
  const value = Number.parseInt(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function storeyIn(line: string) {
  if (/nett\s*floor|fenestr|\d+\s*%/i.test(line)) {
    return undefined;
  }
  const match = line.match(STOREY);
  return match ? normalizeStorey(match[1]) : undefined;
}

function unitArea(unit: WindowUnit) {
  return unit.widthM * unit.heightM * unit.qty;
}

function uniqueUnits(units: WindowUnit[]) {
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

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
