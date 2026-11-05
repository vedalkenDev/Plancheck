import { findWindowTypes, parseWindowUnits } from "@/lib/sans/fenestration";

export type WindowPane = {
  type: string;
  widthM: number;
  heightM: number;
  quote: string;
};

export type WindowScheduleReading = {
  types: string[];
  overall: { type: string; widthM: number; heightM: number }[];
  panes: WindowPane[];
  hasSchedule: boolean;
  missingPaneTypes: string[];
};

const SIZE =
  /(\d+(?:\.\d+)?)\s*(mm|m)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|m)?/gi;
const PANE_WORD = /\b(panes?|sashes?|lights?|fixed|openable|casements?)\b/gi;
const WINDOW_TYPE = /\bW(\d{1,2})\b/gi;

type Tok =
  | { kind: "type"; type: string; index: number }
  | { kind: "pane"; index: number }
  | { kind: "size"; widthM: number; heightM: number; index: number };

export function parsePanes(blob: string): WindowPane[] {
  const panes: WindowPane[] = [];
  let currentType: string | undefined;

  for (const raw of blob.split(/\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) {
      continue;
    }

    const tokens = tokenize(line);
    let paneMode = false;
    for (const token of tokens) {
      if (token.kind === "type") {
        currentType = token.type;
        paneMode = false;
        continue;
      }
      if (token.kind === "pane") {
        paneMode = true;
        continue;
      }
      if (!paneMode || !currentType) {
        continue;
      }
      panes.push({
        type: currentType,
        widthM: token.widthM,
        heightM: token.heightM,
        quote: line,
      });
    }
  }

  return uniquePanes(panes);
}

export function readWindowSchedule(
  blob: string,
  extraUnits: ReturnType<typeof parseWindowUnits> = [],
): WindowScheduleReading {
  const units = [...parseWindowUnits(blob), ...extraUnits];
  const types = [
    ...new Set([...findWindowTypes(blob), ...units.map((unit) => unit.type)]),
  ];
  const panes = parsePanes(blob);
  const overall = uniqueOverall(
    units.map((unit) => ({
      type: unit.type,
      widthM: unit.widthM,
      heightM: unit.heightM,
    })),
  );
  const paneTypes = new Set(panes.map((pane) => pane.type));
  const missingPaneTypes = overall
    .map((unit) => unit.type)
    .filter((type, index, list) => list.indexOf(type) === index && !paneTypes.has(type));

  return {
    types,
    overall,
    panes,
    hasSchedule: /window schedule/i.test(blob) || types.length > 0,
    missingPaneTypes,
  };
}

export function describePanes(reading: WindowScheduleReading) {
  const grouped = new Map<string, WindowPane[]>();
  for (const pane of reading.panes) {
    const list = grouped.get(pane.type) ?? [];
    list.push(pane);
    grouped.set(pane.type, list);
  }
  return [...grouped.entries()]
    .map(
      ([type, panes]) =>
        `${type} ${panes.map((pane) => formatSize(pane.widthM, pane.heightM)).join(" + ")}`,
    )
    .join("; ");
}

export function typeSpan(types: string[]) {
  if (!types.length) {
    return "";
  }
  if (types.length === 1) {
    return types[0];
  }
  return `${types[0]}–${types[types.length - 1]}`;
}

function tokenize(line: string): Tok[] {
  const tokens: Tok[] = [];
  for (const match of line.matchAll(new RegExp(WINDOW_TYPE.source, "gi"))) {
    tokens.push({ kind: "type", type: `W${match[1]}`, index: match.index ?? 0 });
  }
  for (const match of line.matchAll(new RegExp(PANE_WORD.source, "gi"))) {
    tokens.push({ kind: "pane", index: match.index ?? 0 });
  }
  for (const match of line.matchAll(new RegExp(SIZE.source, "gi"))) {
    const width = toMetres(
      Number.parseFloat(match[1]),
      match[2],
      Number.parseFloat(match[3]),
      match[4],
    );
    const height = toMetres(
      Number.parseFloat(match[3]),
      match[4],
      Number.parseFloat(match[1]),
      match[2],
    );
    if (width === null || height === null) {
      continue;
    }
    tokens.push({
      kind: "size",
      widthM: round2(width),
      heightM: round2(height),
      index: match.index ?? 0,
    });
  }
  return tokens.sort((a, b) => a.index - b.index);
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
  const metres =
    named === "m" ||
    (named !== "mm" && value <= 20 && (other <= 20 || otherUnit?.toLowerCase() === "m"));
  const asM = named === "mm" || !metres ? value / 1000 : value;
  if (asM < 0.15 || asM > 4.5) {
    return null;
  }
  return asM;
}

function uniquePanes(panes: WindowPane[]) {
  const seen = new Set<string>();
  const out: WindowPane[] = [];
  for (const pane of panes) {
    const key = `${pane.type}:${pane.widthM}:${pane.heightM}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(pane);
  }
  return out;
}

function uniqueOverall(units: { type: string; widthM: number; heightM: number }[]) {
  const seen = new Set<string>();
  const out: { type: string; widthM: number; heightM: number }[] = [];
  for (const unit of units) {
    const key = `${unit.type}:${unit.widthM}:${unit.heightM}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(unit);
  }
  return out;
}

function formatSize(widthM: number, heightM: number) {
  return `${Math.round(widthM * 1000)} × ${Math.round(heightM * 1000)} mm`;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
