export type DrawingText = {
  kind: "text" | "mtext" | "attrib" | "block" | "layer" | "string";
  value: string;
  layer?: string;
  tag?: string;
};

export type Point = {
  x: number;
  y: number;
};

export type GeomEntity =
  | { kind: "line"; layer?: string; a: Point; b: Point }
  | { kind: "polyline"; layer?: string; closed: boolean; points: Point[] }
  | { kind: "circle"; layer?: string; c: Point; r: number }
  | { kind: "arc"; layer?: string; c: Point; r: number; start: number; end: number }
  | { kind: "text"; layer?: string; p: Point; height: number; value: string };

export type DrawingExtract = {
  format: "dxf" | "dwg" | "unknown";
  texts: DrawingText[];
  strings: string[];
  entityCounts: Record<string, number>;
  geometry: GeomEntity[];
};

const JUNK =
  /^(ACAD|ACDB|AutoCAD|AppId|DIMSTYLE|LTYPE|Continuous|ByLayer|ByBlock|Defpoints|HANDSEED|ObjectDBX|AcDb|SHX|ttf|Annotative|Viewport|MVIEW|Standard|Romans|Arial|ISO|ANSI|Header|CLASSES|ENTITIES|TABLES|BLOCKS|EOF|SECTION|ENDSEC|SEQEND|VERTEX|EXTENDED)/i;

const HEX = /^[0-9A-Fa-f]{8,}$/;

const TEXT_ENTITIES = new Set(["TEXT", "MTEXT", "ATTRIB", "ATTDEF", "DIMENSION"]);

export function extractDrawing(filename: string, bytes: ArrayBuffer): DrawingExtract {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const lowerName = filename.toLowerCase();

  if (looksLikeDxf(utf8, lowerName)) {
    return parseDxf(utf8);
  }

  if (looksLikeDwg(bytes, lowerName)) {
    return parseDwg(bytes);
  }

  if (looksLikeDxf(utf8, "")) {
    return parseDxf(utf8);
  }

  return parseDwg(bytes);
}

function looksLikeDxf(text: string, filename: string) {
  if (filename.endsWith(".dxf")) {
    return true;
  }
  return (
    text.includes("SECTION") &&
    (text.includes("ENTITIES") || text.includes("HEADER"))
  );
}

function looksLikeDwg(bytes: ArrayBuffer, filename: string) {
  if (filename.endsWith(".dwg")) {
    return true;
  }
  const head = new TextDecoder("ascii").decode(bytes.slice(0, 6));
  return head.startsWith("AC10") || head.startsWith("AC1");
}

type InsertEntity = {
  kind: "insert";
  name: string;
  layer?: string;
  p: Point;
  sx: number;
  sy: number;
  rot: number;
  cols: number;
  rows: number;
  colSpace: number;
  rowSpace: number;
};

type RawEntity = GeomEntity | InsertEntity;

type BlockDef = {
  base: Point;
  entities: RawEntity[];
};

function parseDxf(content: string): DrawingExtract {
  const lines = content.split(/\r?\n/);
  const texts: DrawingText[] = [];
  const entityCounts: Record<string, number> = {};
  const blocks = new Map<string, BlockDef>();
  const model: RawEntity[] = [];

  let section = "";
  let expectSection = false;
  let openBlock: { name: string; base: Point; entities: RawEntity[] } | null = null;
  let entity = "";
  let value = "";
  let extra = "";
  let layer = "";
  let tag = "";
  let x = 0;
  let y = 0;
  let x2 = 0;
  let y2 = 0;
  let r = 0;
  let start = 0;
  let end = 0;
  let height = 2.5;
  let flags = 0;
  let sx = 1;
  let sy = 1;
  let cols = 1;
  let rows = 1;
  let colSpace = 0;
  let rowSpace = 0;
  let pendingX = 0;
  let points: Point[] = [];
  let hasStart = false;
  let hasEnd = false;
  let hasRadius = false;

  function resetEntity(next: string, keepPolyline: boolean) {
    entity = next;
    value = "";
    extra = "";
    tag = "";
    x = 0;
    y = 0;
    x2 = 0;
    y2 = 0;
    r = 0;
    start = 0;
    end = 0;
    height = 2.5;
    sx = 1;
    sy = 1;
    cols = 1;
    rows = 1;
    colSpace = 0;
    rowSpace = 0;
    pendingX = 0;
    hasStart = false;
    hasEnd = false;
    hasRadius = false;
    if (!keepPolyline) {
      layer = "";
      flags = 0;
      points = [];
    }
  }

  function commit(raw: RawEntity | null) {
    if (!raw || /^defpoints$/i.test(raw.layer ?? "")) {
      return;
    }
    if (openBlock && entity !== "BLOCK") {
      openBlock.entities.push(raw);
      return;
    }
    if (section === "ENTITIES") {
      model.push(raw);
    }
  }

  function flush() {
    if (entity === "VERTEX") {
      entity = "POLYLINE";
    }
    const combined = stripDxfMarkup(`${value}${extra}`).trim();
    const drawnLayer = layer || undefined;
    if (TEXT_ENTITIES.has(entity) && combined) {
      texts.push({
        kind: entity === "MTEXT" ? "mtext" : entity === "TEXT" ? "text" : "attrib",
        value: combined,
        layer: drawnLayer,
        tag: tag || undefined,
      });
      commit({
        kind: "text",
        layer: drawnLayer,
        p: { x, y },
        height,
        value: combined,
      });
      return;
    }
    if (entity === "INSERT" && tag) {
      texts.push({ kind: "block", value: tag });
      commit({
        kind: "insert",
        name: tag,
        layer: drawnLayer,
        p: { x, y },
        sx: sx || 1,
        sy: sy || 1,
        rot: start || 0,
        cols: cols || 1,
        rows: rows || 1,
        colSpace,
        rowSpace,
      });
      return;
    }
    if (entity === "LAYER" && tag) {
      texts.push({ kind: "layer", value: tag });
      return;
    }
    if (entity === "LINE" && hasStart && hasEnd) {
      commit({
        kind: "line",
        layer: drawnLayer,
        a: { x, y },
        b: { x: x2, y: y2 },
      });
      return;
    }
    if (
      (entity === "LWPOLYLINE" || entity === "POLYLINE" || entity === "SPLINE") &&
      points.length >= 2
    ) {
      commit({
        kind: "polyline",
        layer: drawnLayer,
        closed: (flags & 1) === 1,
        points: points.slice(),
      });
      return;
    }
    if (entity === "CIRCLE" && hasRadius) {
      commit({ kind: "circle", layer: drawnLayer, c: { x, y }, r });
      return;
    }
    if (entity === "ARC" && hasRadius) {
      commit({ kind: "arc", layer: drawnLayer, c: { x, y }, r, start, end });
    }
  }

  for (let i = 0; i < lines.length - 1; i += 1) {
    const code = Number.parseInt(lines[i]?.trim() ?? "", 10);
    if (Number.isNaN(code)) {
      continue;
    }
    const raw = lines[i + 1] ?? "";
    i += 1;

    if (code === 0) {
      const next = raw.trim();
      const polyline = entity === "POLYLINE" || entity === "VERTEX";
      if (polyline && next === "VERTEX") {
        entity = "VERTEX";
        entityCounts[next] = (entityCounts[next] ?? 0) + 1;
        value = "";
        extra = "";
        tag = "";
        hasStart = false;
        continue;
      }
      flush();
      if (entity === "BLOCK" && openBlock?.name) {
        blocks.set(openBlock.name, {
          base: openBlock.base,
          entities: openBlock.entities,
        });
      }
      if (next === "ENDBLK") {
        openBlock = null;
      }
      if (next === "ENDSEC") {
        section = "";
        openBlock = null;
      }
      if (next === "SECTION") {
        expectSection = true;
      }
      if (next === "BLOCK" && section === "BLOCKS") {
        openBlock = { name: "", base: { x: 0, y: 0 }, entities: [] };
      }
      entityCounts[next] = (entityCounts[next] ?? 0) + 1;
      resetEntity(next, false);
      continue;
    }

    if (code === 2 && expectSection) {
      section = raw.trim().toUpperCase();
      expectSection = false;
      continue;
    }

    if (code === 1) {
      value = raw;
    } else if (code === 3) {
      extra += raw;
    } else if (code === 8) {
      layer = raw.trim();
    } else if (code === 2) {
      const name = raw.trim();
      if (entity === "BLOCK" && openBlock) {
        openBlock.name = name;
      } else {
        tag = name;
      }
    } else if (code === 10) {
      pendingX = Number.parseFloat(raw);
      if (entity === "BLOCK" && openBlock) {
        openBlock.base.x = pendingX;
        continue;
      }
      if (isPointList(entity)) {
        continue;
      }
      x = pendingX;
      hasStart = true;
    } else if (code === 20) {
      const py = Number.parseFloat(raw);
      if (entity === "BLOCK" && openBlock) {
        openBlock.base.y = py;
        continue;
      }
      if (isPointList(entity)) {
        points.push({ x: pendingX, y: py });
      } else {
        y = py;
        hasStart = true;
      }
    } else if (code === 11) {
      x2 = Number.parseFloat(raw);
    } else if (code === 21) {
      y2 = Number.parseFloat(raw);
      hasEnd = true;
    } else if (code === 40) {
      const num = Number.parseFloat(raw);
      if (entity === "CIRCLE" || entity === "ARC") {
        r = num;
        hasRadius = true;
      } else if (Number.isFinite(num) && num > 0) {
        height = num;
      }
    } else if (code === 41 && entity === "INSERT") {
      sx = Number.parseFloat(raw) || 1;
    } else if (code === 42 && entity === "INSERT") {
      sy = Number.parseFloat(raw) || 1;
    } else if (code === 44 && entity === "INSERT") {
      colSpace = Number.parseFloat(raw) || 0;
    } else if (code === 45 && entity === "INSERT") {
      rowSpace = Number.parseFloat(raw) || 0;
    } else if (code === 50) {
      start = Number.parseFloat(raw);
    } else if (code === 51) {
      end = Number.parseFloat(raw);
    } else if (code === 70) {
      const num = Number.parseInt(raw.trim(), 10) || 0;
      if (entity === "INSERT") {
        cols = num || 1;
      } else {
        flags = num;
      }
    } else if (code === 71 && entity === "INSERT") {
      rows = Number.parseInt(raw.trim(), 10) || 1;
    }
  }
  flush();

  const placed = placeInserts(model, blocks);
  const geometry = placed.some(isDrawn) ? placed : modelSpaceFallback(blocks);

  return {
    format: "dxf",
    texts,
    strings: uniqueStrings(texts.map((item) => item.value)),
    entityCounts,
    geometry,
  };
}

function isPointList(entity: string) {
  return (
    entity === "LWPOLYLINE" ||
    entity === "POLYLINE" ||
    entity === "VERTEX" ||
    entity === "SPLINE"
  );
}

function isDrawn(entity: GeomEntity) {
  return entity.kind !== "text";
}

function modelSpaceFallback(blocks: Map<string, BlockDef>) {
  for (const [name, block] of blocks) {
    if (name.replace(/[$*]/g, "").toLowerCase() === "model_space") {
      return placeInserts(block.entities, blocks);
    }
  }
  return [];
}

function placeInserts(entities: RawEntity[], blocks: Map<string, BlockDef>) {
  return expandEntities(entities, blocks, new Set(), 0);
}

function expandEntities(
  entities: RawEntity[],
  blocks: Map<string, BlockDef>,
  stack: Set<string>,
  depth: number,
): GeomEntity[] {
  const out: GeomEntity[] = [];
  for (const entity of entities) {
    if (entity.kind !== "insert") {
      out.push(entity);
      continue;
    }
    const key = entity.name.toLowerCase();
    if (depth > 8 || stack.has(key)) {
      continue;
    }
    const block = findBlock(blocks, entity.name);
    if (!block) {
      continue;
    }
    stack.add(key);
    const inner = expandEntities(block.entities, blocks, stack, depth + 1);
    stack.delete(key);
    const columns = Math.max(1, entity.cols);
    const rows = Math.max(1, entity.rows);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        for (const child of inner) {
          out.push(transformEntity(child, entity, block.base, col, row));
        }
      }
    }
  }
  return out;
}

function findBlock(blocks: Map<string, BlockDef>, name: string) {
  const direct = blocks.get(name);
  if (direct) {
    return direct;
  }
  const lower = name.toLowerCase();
  for (const [key, block] of blocks) {
    if (key.toLowerCase() === lower) {
      return block;
    }
  }
  return undefined;
}

function transformEntity(
  entity: GeomEntity,
  insert: InsertEntity,
  base: Point,
  col: number,
  row: number,
): GeomEntity {
  const map = (point: Point) => transformPoint(point, insert, base, col, row);
  if (entity.kind === "line") {
    return { ...entity, a: map(entity.a), b: map(entity.b) };
  }
  if (entity.kind === "polyline") {
    return { ...entity, points: entity.points.map(map) };
  }
  if (entity.kind === "text") {
    return {
      ...entity,
      p: map(entity.p),
      height: entity.height * Math.abs(insert.sy || 1),
    };
  }
  const scale = Math.max(Math.abs(insert.sx || 1), Math.abs(insert.sy || 1));
  const center = map(entity.c);
  const radius = entity.r * scale;
  if (entity.kind === "circle") {
    return { ...entity, c: center, r: radius };
  }
  let arcStart = entity.start;
  let arcEnd = entity.end;
  if (insert.sx < 0) {
    arcStart = 180 - arcStart;
    arcEnd = 180 - arcEnd;
  }
  if (insert.sy < 0) {
    arcStart = -arcStart;
    arcEnd = -arcEnd;
  }
  if (insert.sx < 0 !== insert.sy < 0) {
    const swap = arcStart;
    arcStart = arcEnd;
    arcEnd = swap;
  }
  return {
    ...entity,
    c: center,
    r: radius,
    start: arcStart + insert.rot,
    end: arcEnd + insert.rot,
  };
}

function transformPoint(point: Point, insert: InsertEntity, base: Point, col: number, row: number) {
  const localX = (point.x - base.x) * insert.sx;
  const localY = (point.y - base.y) * insert.sy;
  const rad = (insert.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotatedX = localX * cos - localY * sin;
  const rotatedY = localX * sin + localY * cos;
  const arrayX = col * insert.colSpace;
  const arrayY = row * insert.rowSpace;
  return {
    x: insert.p.x + rotatedX + arrayX * cos - arrayY * sin,
    y: insert.p.y + rotatedY + arrayX * sin + arrayY * cos,
  };
}

function parseDwg(bytes: ArrayBuffer): DrawingExtract {
  const ascii = extractAsciiStrings(new Uint8Array(bytes));
  const utf16 = extractUtf16Strings(new Uint8Array(bytes));
  const texts = uniqueStrings([...ascii, ...utf16]).map((value) => ({
    kind: "string" as const,
    value,
  }));

  return {
    format: "dwg",
    texts,
    strings: texts.map((item) => item.value),
    entityCounts: { STRING: texts.length },
    geometry: [],
  };
}

function extractAsciiStrings(data: Uint8Array) {
  const found: string[] = [];
  let start = 0;
  for (let i = 0; i <= data.length; i += 1) {
    const byte = data[i] ?? 0;
    const printable = byte >= 32 && byte <= 126;
    if (printable && i < data.length) {
      continue;
    }
    if (i - start >= 4) {
      const chunk = String.fromCharCode(...data.subarray(start, i));
      if (keepString(chunk)) {
        found.push(chunk);
      }
    }
    start = i + 1;
  }
  return found;
}

function extractUtf16Strings(data: Uint8Array) {
  const found: string[] = [];
  let chars: string[] = [];
  for (let i = 0; i + 1 < data.length; i += 2) {
    const lo = data[i];
    const hi = data[i + 1];
    if (hi === 0 && lo >= 32 && lo <= 126) {
      chars.push(String.fromCharCode(lo));
      continue;
    }
    if (chars.length >= 4) {
      const chunk = chars.join("");
      if (keepString(chunk)) {
        found.push(chunk);
      }
    }
    chars = [];
  }
  if (chars.length >= 4) {
    const chunk = chars.join("");
    if (keepString(chunk)) {
      found.push(chunk);
    }
  }
  return found;
}

function keepString(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 4 || text.length > 180) {
    return false;
  }
  if (JUNK.test(text) || HEX.test(text)) {
    return false;
  }
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  if (letters < 3) {
    return false;
  }
  return true;
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value.replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(text);
  }
  return out;
}

function stripDxfMarkup(value: string) {
  return value
    .replace(/\\[Pp]~?;/g, " ")
    .replace(/\\[A-Za-z][^;]*;/g, "")
    .replace(/[{}]/g, "")
    .replace(/%%[UuOo]/g, "");
}
