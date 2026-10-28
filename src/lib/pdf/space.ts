import type { AuditSample } from "@/data/types";
import type { GeomEntity } from "@/lib/cad/extract";
import { geometryBounds } from "@/lib/cad/preview";

export type PageBox = {
  width: number;
  height: number;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type NoteCard = {
  id: string;
  title: string;
  body: string;
  minW: number;
  minH: number;
  tone?: "fail" | "note";
};

export type PlacedCard = {
  card: NoteCard;
  rect: Rect;
};

const COLS = 80;
const PAGE_MARGIN = 12;
const PLAN_PAD = 10;
const TEXT_PAD = 8;
const GAP = 8;
const INSET = 8;
const HARD_MIN_W = 150;
const HARD_MIN_H = 48;
const MAX_CARD_W = 280;

/**
 * Pack note cards into empty paper around the drawing.
 *
 * The plan is treated as one occupied block (its linework bounds) so cards
 * land in the sheet margins, not inside rooms. Titleblock text is occupied
 * separately. Leftover cards did not fit on this page.
 */
export function layoutNoteCards(
  geometry: GeomEntity[],
  page: PageBox,
  cards: NoteCard[],
): { placed: PlacedCard[]; leftover: NoteCard[] } {
  if (!cards.length || page.width <= 1 || page.height <= 1) {
    return { placed: [], leftover: [...cards] };
  }

  const cols = COLS;
  const rows = Math.max(24, Math.round((COLS * page.height) / page.width));
  const cellW = page.width / cols;
  const cellH = page.height / rows;
  const grid = occupyPage(geometry, page, cols, rows, cellW, cellH);
  const remaining = [...cards];
  const placed: PlacedCard[] = [];

  for (let step = 0; step < 64 && remaining.length; step += 1) {
    const pocket = largestEmptyRect(grid, cols, rows, cellW, cellH);
    if (!pocket) {
      break;
    }
    const packed = packInPocket(pocket, remaining);
    if (!packed.length) {
      markRect(grid, cols, rows, cellW, cellH, pocket, 0);
      continue;
    }
    for (const item of packed) {
      placed.push(item);
      markRect(grid, cols, rows, cellW, cellH, inflate(item.rect, GAP / 2), 0);
    }
  }

  return { placed, leftover: remaining };
}

export function cardsFromAudit(audit: AuditSample): NoteCard[] {
  return [
    {
      id: "verdict",
      title: "PLANCHECK",
      body: `${audit.verdict}\nNot a stamp. Not municipal approval.`,
      minW: 210,
      minH: 64,
    },
    ...audit.failed.map((row) => ({
      id: row.id,
      title: `SANS ${row.part}  ${row.check}`,
      body: `${row.detail}\n${row.adjust}`,
      minW: 200,
      minH: 80,
      tone: "fail" as const,
    })),
  ];
}

export function rectsOverlap(a: Rect, b: Rect, pad = 0) {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w + pad > b.x &&
    a.y < b.y + b.h + pad &&
    a.y + a.h + pad > b.y
  );
}

function occupyPage(
  geometry: GeomEntity[],
  page: PageBox,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
) {
  const grid = new Uint8Array(cols * rows);
  markRect(
    grid,
    cols,
    rows,
    cellW,
    cellH,
    { x: 0, y: 0, w: page.width, h: PAGE_MARGIN },
    0,
  );
  markRect(
    grid,
    cols,
    rows,
    cellW,
    cellH,
    { x: 0, y: page.height - PAGE_MARGIN, w: page.width, h: PAGE_MARGIN },
    0,
  );
  markRect(
    grid,
    cols,
    rows,
    cellW,
    cellH,
    { x: 0, y: 0, w: PAGE_MARGIN, h: page.height },
    0,
  );
  markRect(
    grid,
    cols,
    rows,
    cellW,
    cellH,
    { x: page.width - PAGE_MARGIN, y: 0, w: PAGE_MARGIN, h: page.height },
    0,
  );

  const plan = planBlock(geometry, page);
  if (plan) {
    markRect(grid, cols, rows, cellW, cellH, plan, PLAN_PAD);
  }

  for (const entity of geometry) {
    if (entity.kind !== "text") {
      continue;
    }
    const height = Math.max(entity.height, 6);
    const width =
      entity.width && entity.width > 0
        ? entity.width
        : Math.max(height, entity.value.length * height * 0.55);
    const top = entity.valign === "top" ? entity.p.y : entity.p.y + height;
    const bottom = top - height;
    markRect(
      grid,
      cols,
      rows,
      cellW,
      cellH,
      { x: entity.p.x, y: bottom, w: width, h: height },
      TEXT_PAD,
    );
  }

  return grid;
}

function planBlock(geometry: GeomEntity[], page: PageBox): Rect | null {
  const linework = geometry.filter((entity) => entity.kind !== "text");
  const bounds = geometryBounds(linework);
  if (!bounds) {
    return null;
  }
  const minX = Math.max(0, bounds.minX);
  const minY = Math.max(0, bounds.minY);
  const maxX = Math.min(page.width, bounds.maxX);
  const maxY = Math.min(page.height, bounds.maxY);
  if (maxX - minX < 8 || maxY - minY < 8) {
    return null;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function packInPocket(pocket: Rect, remaining: NoteCard[]): PlacedCard[] {
  const inner: Rect = {
    x: pocket.x + INSET,
    y: pocket.y + INSET,
    w: pocket.w - INSET * 2,
    h: pocket.h - INSET * 2,
  };
  if (inner.w < HARD_MIN_W || inner.h < HARD_MIN_H) {
    return [];
  }

  const placed: PlacedCard[] = [];
  if (inner.h >= inner.w) {
    let top = inner.y + inner.h;
    while (remaining.length) {
      const card = remaining[0];
      const size = cardSize(card, inner.w, top - inner.y);
      if (!size) {
        break;
      }
      const y = top - size.h;
      placed.push({ card, rect: { x: inner.x, y, w: size.w, h: size.h } });
      remaining.shift();
      top = y - GAP;
    }
    return placed;
  }

  let left = inner.x;
  while (remaining.length) {
    const card = remaining[0];
    const roomW = inner.x + inner.w - left;
    const size = cardSize(card, roomW, inner.h);
    if (!size) {
      break;
    }
    placed.push({
      card,
      rect: { x: left, y: inner.y + inner.h - size.h, w: size.w, h: size.h },
    });
    remaining.shift();
    left += size.w + GAP;
  }
  return placed;
}

function cardSize(card: NoteCard, roomW: number, roomH: number) {
  if (roomW < HARD_MIN_W || roomH < HARD_MIN_H) {
    return null;
  }
  const w = Math.min(roomW, Math.max(HARD_MIN_W, Math.min(card.minW, MAX_CARD_W)));
  const h = Math.min(roomH, Math.max(HARD_MIN_H, card.minH));
  if (w > roomW + 0.01 || h > roomH + 0.01) {
    return null;
  }
  return { w, h };
}

function largestEmptyRect(
  grid: Uint8Array,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
): Rect | null {
  const heights = new Uint16Array(cols);
  let best: { area: number; c0: number; c1: number; r0: number; r1: number } | null = null;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      heights[c] = grid[r * cols + c] ? 0 : heights[c] + 1;
    }
    const found = maxHistogram(heights, r + 1);
    if (found && (!best || found.area > best.area)) {
      best = found;
    }
  }
  if (!best) {
    return null;
  }
  return {
    x: best.c0 * cellW,
    y: best.r0 * cellH,
    w: (best.c1 - best.c0) * cellW,
    h: (best.r1 - best.r0) * cellH,
  };
}

function maxHistogram(heights: Uint16Array, rowExclusive: number) {
  const stack = [-1];
  let best: { area: number; c0: number; c1: number; r0: number; r1: number } | null = null;
  for (let i = 0; i <= heights.length; i += 1) {
    const h = i === heights.length ? 0 : heights[i];
    while (stack.length > 1 && heights[stack[stack.length - 1]] >= h) {
      const height = heights[stack.pop() as number];
      const c0 = stack[stack.length - 1] + 1;
      const c1 = i;
      const area = height * (c1 - c0);
      if (height > 0 && (!best || area > best.area)) {
        best = { area, c0, c1, r0: rowExclusive - height, r1: rowExclusive };
      }
    }
    stack.push(i);
  }
  return best;
}

function markRect(
  grid: Uint8Array,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
  rect: Rect,
  pad: number,
) {
  if (rect.w <= 0 || rect.h <= 0) {
    return;
  }
  const c0 = clamp(Math.floor((rect.x - pad) / cellW), 0, cols - 1);
  const c1 = clamp(Math.ceil((rect.x + rect.w + pad) / cellW) - 1, 0, cols - 1);
  const r0 = clamp(Math.floor((rect.y - pad) / cellH), 0, rows - 1);
  const r1 = clamp(Math.ceil((rect.y + rect.h + pad) / cellH) - 1, 0, rows - 1);
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      grid[r * cols + c] = 1;
    }
  }
}

function inflate(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    w: rect.w + pad * 2,
    h: rect.h + pad * 2,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
