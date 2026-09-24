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

type Appearance = {
  layer?: string;
  color?: string;
  weight?: number;
  dash?: number[];
};

export type GeomEntity =
  | (Appearance & { kind: "line"; a: Point; b: Point })
  | (Appearance & {
      kind: "polyline";
      closed: boolean;
      points: Point[];
      fill?: boolean;
      pattern?: number;
    })
  | (Appearance & { kind: "circle"; c: Point; r: number })
  | (Appearance & { kind: "arc"; c: Point; r: number; start: number; end: number })
  | (Appearance & {
      kind: "text";
      p: Point;
      height: number;
      value: string;
      rotation?: number;
      align?: "left" | "center" | "right";
      valign?: "baseline" | "middle" | "top";
      width?: number;
    });

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

const TEXT_ENTITIES = new Set(["TEXT", "MTEXT", "ATTRIB", "ATTDEF"]);

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
  color?: string;
  weight?: number;
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

type SheetViewport = {
  id: number;
  on: boolean;
  cx: number;
  cy: number;
  w: number;
  h: number;
  mx: number;
  my: number;
  viewH: number;
  twist: number;
};

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function parseDxf(content: string): DrawingExtract {
  const lines = content.split(/\r?\n/);
  const texts: DrawingText[] = [];
  const entityCounts: Record<string, number> = {};
  const blocks = new Map<string, BlockDef>();
  const layers = new Map<string, { color?: number; weight?: number; lineType?: string }>();
  const lineTypes = new Map<string, number[]>();
  const model: RawEntity[] = [];
  const paper: RawEntity[] = [];
  const viewports: SheetViewport[] = [];
  let headerVar = "";
  let ltScale = 1;
  let inPaper = false;
  let embedded = false;

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
  let column = 0;
  let flags = 0;
  let sx = 1;
  let sy = 1;
  let cols = 1;
  let rows = 1;
  let colSpace = 0;
  let rowSpace = 0;
  let pendingX = 0;
  let points: Point[] = [];
  let bulges: number[] = [];
  let chunks: { code: number; value: string }[] = [];
  let hasStart = false;
  let hasEnd = false;
  let hasRadius = false;
  let aci: number | null = null;
  let lineweight: number | null = null;
  let degree = 3;
  let knots: number[] = [];
  let fitPoints: Point[] = [];
  let pendingFitX = 0;
  let lineType = "";
  let lineTypeScale = 1;
  let dashItems: number[] = [];
  let hAlign = 0;
  let vAlign = 0;
  let attach = 0;
  let textRot: number | null = null;

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
    column = 0;
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
    aci = null;
    lineweight = null;
    degree = 3;
    knots = [];
    fitPoints = [];
    pendingFitX = 0;
    lineType = "";
    lineTypeScale = 1;
    dashItems = [];
    hAlign = 0;
    vAlign = 0;
    attach = 0;
    textRot = null;
    chunks = [];
    inPaper = false;
    embedded = false;
    if (!keepPolyline) {
      layer = "";
      flags = 0;
      points = [];
      bulges = [];
    }
  }

  function commit(raw: RawEntity | null) {
    if (!raw || /^defpoints$/i.test(raw.layer ?? "")) {
      return;
    }
    const known = raw.layer ? layers.get(raw.layer.toLowerCase()) : undefined;
    const color = aciColor(aci, known?.color);
    const weight = strokeWeight(lineweight, known?.weight);
    const dash = resolveDash(lineType, known?.lineType, lineTypes, lineTypeScale * ltScale);
    const painted =
      color || weight !== undefined || dash
        ? {
            ...raw,
            ...(color ? { color } : {}),
            ...(weight !== undefined ? { weight } : {}),
            ...(dash ? { dash } : {}),
          }
        : raw;
    if (openBlock && entity !== "BLOCK") {
      openBlock.entities.push(painted);
      return;
    }
    if (section === "ENTITIES") {
      (inPaper ? paper : model).push(painted);
    }
  }

  function flush() {
    if (entity === "VERTEX") {
      entity = "POLYLINE";
    }
    const drawnLayer = layer || undefined;
    if (entity === "VIEWPORT") {
      const viewport = viewportFrom(chunks);
      if (inPaper && viewport) {
        viewports.push(viewport);
      }
      return;
    }
    if (entity === "ELLIPSE" || entity === "SOLID" || entity === "HATCH") {
      for (const shape of shapesFrom(entity, chunks, drawnLayer)) {
        commit(shape);
      }
      return;
    }
    const combined = stripDxfMarkup(entity === "MTEXT" ? `${extra}${value}` : `${value}${extra}`).trim();
    if (entity === "DIMENSION") {
      if (combined) {
        texts.push({
          kind: "text",
          value: combined,
          layer: drawnLayer,
          tag: tag || undefined,
        });
      }
      if (tag && findBlock(blocks, tag)) {
        commit({
          kind: "insert",
          name: tag,
          layer: drawnLayer,
          p: { x: 0, y: 0 },
          sx: 1,
          sy: 1,
          rot: 0,
          cols: 1,
          rows: 1,
          colSpace: 0,
          rowSpace: 0,
        });
      } else if (combined) {
        commit({
          kind: "text",
          layer: drawnLayer,
          p: { x: hasEnd ? x2 : x, y: hasEnd ? y2 : y },
          height,
          value: combined,
        });
      }
      return;
    }
    if (entity === "SPLINE") {
      const curve =
        splinePoints(points, knots, degree) ?? (fitPoints.length >= 2 ? fitPoints : points);
      if (curve.length >= 2) {
        commit({
          kind: "polyline",
          layer: drawnLayer,
          closed: (flags & 1) === 1,
          points: curve,
        });
      }
      return;
    }
    if (TEXT_ENTITIES.has(entity) && combined) {
      texts.push({
        kind: entity === "MTEXT" ? "mtext" : entity === "TEXT" ? "text" : "attrib",
        value: combined,
        layer: drawnLayer,
        tag: tag || undefined,
      });
      const placed = textPlacement(entity, { x, y }, { x: x2, y: y2 }, hasEnd, hAlign, vAlign, attach);
      const rotation = textAngle(entity, textRot);
      commit({
        kind: "text",
        layer: drawnLayer,
        p: placed.p,
        height,
        value: combined,
        ...(column > 0 ? { width: column } : {}),
        ...(rotation ? { rotation } : {}),
        ...(placed.align ? { align: placed.align } : {}),
        ...(placed.valign ? { valign: placed.valign } : {}),
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
      const color = aci === null ? undefined : Math.abs(Math.trunc(aci));
      layers.set(tag.toLowerCase(), {
        color: color && color < 256 ? color : undefined,
        weight: lineweight !== null && lineweight >= 0 ? lineweight : undefined,
        lineType: lineType || undefined,
      });
      return;
    }
    if (entity === "LTYPE" && tag) {
      if (dashItems.length) {
        lineTypes.set(tag.toLowerCase(), dashItems.slice());
      }
      return;
    }
    if (entity === "LEADER" && points.length >= 2) {
      commit({
        kind: "polyline",
        layer: drawnLayer,
        closed: false,
        points,
      });
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
      (entity === "LWPOLYLINE" || entity === "POLYLINE") &&
      points.length >= 2
    ) {
      const shaped = withBulges(points, bulges, (flags & 1) === 1);
      commit({
        kind: "polyline",
        layer: drawnLayer,
        closed: shaped.closed,
        points: shaped.points,
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

    if (code === 101) {
      embedded = true;
      continue;
    }
    if (embedded && code !== 0) {
      continue;
    }

    if (
      code !== 0 &&
      (entity === "HATCH" || entity === "SOLID" || entity === "ELLIPSE" || entity === "VIEWPORT")
    ) {
      chunks.push({ code, value: raw.trim() });
    }

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
    } else if (code === 6) {
      lineType = raw.trim();
    } else if (code === 9) {
      headerVar = raw.trim().toUpperCase();
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
        bulges.push(0);
      } else {
        y = py;
        hasStart = true;
      }
    } else if (code === 11) {
      if (entity === "SPLINE") {
        pendingFitX = Number.parseFloat(raw);
      } else {
        x2 = Number.parseFloat(raw);
      }
    } else if (code === 21) {
      if (entity === "SPLINE") {
        fitPoints.push({ x: pendingFitX, y: Number.parseFloat(raw) });
      } else {
        y2 = Number.parseFloat(raw);
        hasEnd = true;
      }
    } else if (code === 40 && section === "HEADER" && headerVar === "$LTSCALE") {
      const num = Number.parseFloat(raw);
      if (Number.isFinite(num) && num > 0) {
        ltScale = num;
      }
    } else if (code === 40) {
      const num = Number.parseFloat(raw);
      if (entity === "CIRCLE" || entity === "ARC") {
        r = num;
        hasRadius = true;
      } else if (entity === "SPLINE") {
        if (Number.isFinite(num)) {
          knots.push(num);
        }
      } else if (Number.isFinite(num) && num > 0) {
        height = num;
      }
    } else if (code === 41 && entity === "MTEXT") {
      const num = Number.parseFloat(raw);
      if (Number.isFinite(num) && num > 0) {
        column = num;
      }
    } else if (code === 41 && entity === "INSERT") {
      sx = Number.parseFloat(raw) || 1;
    } else if (code === 42 && (entity === "LWPOLYLINE" || entity === "VERTEX")) {
      const bulge = Number.parseFloat(raw);
      if (bulges.length && Number.isFinite(bulge)) {
        bulges[bulges.length - 1] = bulge;
      }
    } else if (code === 42 && entity === "INSERT") {
      sy = Number.parseFloat(raw) || 1;
    } else if (code === 44 && entity === "INSERT") {
      colSpace = Number.parseFloat(raw) || 0;
    } else if (code === 45 && entity === "INSERT") {
      rowSpace = Number.parseFloat(raw) || 0;
    } else if (code === 48) {
      const num = Number.parseFloat(raw);
      if (Number.isFinite(num) && num > 0) {
        lineTypeScale = num;
      }
    } else if (code === 49 && entity === "LTYPE") {
      const num = Number.parseFloat(raw);
      if (Number.isFinite(num)) {
        dashItems.push(num);
      }
    } else if (code === 50) {
      const num = Number.parseFloat(raw);
      if (TEXT_ENTITIES.has(entity)) {
        textRot = num;
      } else {
        start = num;
      }
    } else if (code === 51) {
      end = Number.parseFloat(raw);
    } else if (code === 70) {
      const num = Number.parseInt(raw.trim(), 10) || 0;
      if (entity === "INSERT") {
        cols = num || 1;
      } else {
        flags = num;
      }
    } else if (code === 67) {
      inPaper = raw.trim() === "1";
    } else if (code === 62) {
      const num = Number.parseInt(raw.trim(), 10);
      if (Number.isFinite(num)) {
        aci = num;
      }
    } else if (code === 71) {
      const num = Number.parseInt(raw.trim(), 10) || 0;
      if (entity === "INSERT") {
        rows = num || 1;
      } else if (entity === "MTEXT") {
        attach = num;
      } else if (entity === "SPLINE" && num > 0) {
        degree = num;
      }
    } else if (code === 72 && (entity === "TEXT" || entity === "ATTRIB" || entity === "ATTDEF")) {
      hAlign = Number.parseInt(raw.trim(), 10) || 0;
    } else if (code === 73 && (entity === "TEXT" || entity === "ATTRIB" || entity === "ATTDEF")) {
      vAlign = Number.parseInt(raw.trim(), 10) || 0;
    } else if (code === 370) {
      const num = Number.parseInt(raw.trim(), 10);
      if (Number.isFinite(num)) {
        lineweight = num;
      }
    }
  }
  flush();

  const placed = placeInserts(model, blocks);
  const sheet = composeSheet(placed, placeInserts(paper, blocks), viewports);
  const drawn = sheet ?? placed;
  const fallback = drawn.some(isDrawn) ? drawn : modelSpaceFallback(blocks);
  const geometry = fallback.length ? fallback : drawn;

  return {
    format: "dxf",
    texts,
    strings: uniqueStrings(texts.map((item) => item.value.replace(/\s+/g, " "))),
    entityCounts,
    geometry,
  };
}

function isPointList(entity: string) {
  return (
    entity === "LWPOLYLINE" ||
    entity === "POLYLINE" ||
    entity === "VERTEX" ||
    entity === "SPLINE" ||
    entity === "LEADER"
  );
}

function shapesFrom(
  entity: string,
  pairs: { code: number; value: string }[],
  layer?: string,
): GeomEntity[] {
  if (entity === "ELLIPSE") {
    const ellipse = ellipseFrom(pairs, layer);
    return ellipse ? [ellipse] : [];
  }
  if (entity === "SOLID") {
    const solid = solidFrom(pairs, layer);
    return solid ? [solid] : [];
  }
  if (entity === "HATCH") {
    return hatchFrom(pairs, layer);
  }
  return [];
}

function ellipseFrom(
  pairs: { code: number; value: string }[],
  layer?: string,
): GeomEntity | null {
  let cx = 0;
  let cy = 0;
  let mx = 0;
  let my = 0;
  let ratio = 1;
  let start = 0;
  let end = Math.PI * 2;
  let hasMajor = false;
  for (const pair of pairs) {
    if (pair.code === 10) {
      cx = dxfNum(pair.value);
    } else if (pair.code === 20) {
      cy = dxfNum(pair.value);
    } else if (pair.code === 11) {
      mx = dxfNum(pair.value);
      hasMajor = true;
    } else if (pair.code === 21) {
      my = dxfNum(pair.value);
    } else if (pair.code === 40) {
      ratio = dxfNum(pair.value) || 1;
    } else if (pair.code === 41) {
      start = dxfNum(pair.value);
    } else if (pair.code === 42) {
      end = dxfNum(pair.value);
    }
  }
  if (!hasMajor) {
    return null;
  }
  const points = sampleEllipse({ x: cx, y: cy }, { x: mx, y: my }, ratio, start, end);
  if (points.length < 2) {
    return null;
  }
  const sweep = Math.abs(end - start);
  const full = sweep < 1e-4 || Math.abs(sweep - Math.PI * 2) < 1e-3;
  return { kind: "polyline", layer, closed: full, points };
}

function sampleEllipse(center: Point, major: Point, ratio: number, start: number, end: number) {
  const rx = Math.hypot(major.x, major.y);
  if (rx < 1e-9) {
    return [];
  }
  const rot = Math.atan2(major.y, major.x);
  const ry = rx * ratio;
  let sweep = end - start;
  if (sweep <= 1e-6) {
    sweep += Math.PI * 2;
  }
  const steps = Math.max(12, Math.ceil((48 * sweep) / (Math.PI * 2)));
  const points: Point[] = [];
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (let i = 0; i <= steps; i += 1) {
    const t = start + (sweep * i) / steps;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    points.push({
      x: center.x + x * cos - y * sin,
      y: center.y + x * sin + y * cos,
    });
  }
  return points;
}

function solidFrom(
  pairs: { code: number; value: string }[],
  layer?: string,
): GeomEntity | null {
  const xs = new Map<number, number>();
  const ys = new Map<number, number>();
  for (const pair of pairs) {
    if (pair.code >= 10 && pair.code <= 13) {
      xs.set(pair.code, dxfNum(pair.value));
    } else if (pair.code >= 20 && pair.code <= 23) {
      ys.set(pair.code - 10, dxfNum(pair.value));
    }
  }
  const corner = (code: number) =>
    xs.has(code) && ys.has(code) ? { x: xs.get(code) ?? 0, y: ys.get(code) ?? 0 } : null;
  const first = corner(10);
  const second = corner(11);
  const third = corner(12);
  const fourth = corner(13);
  if (!first || !second || !third) {
    return null;
  }
  const distinctFourth =
    fourth !== null && Math.hypot(fourth.x - third.x, fourth.y - third.y) > 1e-6;
  return {
    kind: "polyline",
    layer,
    closed: true,
    fill: true,
    points: distinctFourth ? [first, second, fourth, third] : [first, second, third],
  };
}

function hatchFrom(pairs: { code: number; value: string }[], layer?: string) {
  const solid = pairs.some((pair) => pair.code === 70 && dxfNum(pair.value) === 1);
  const out: GeomEntity[] = [];
  let index = pairs.findIndex((pair) => pair.code === 91);
  if (index < 0) {
    return out;
  }
  const paths = dxfNum(pairs[index]?.value ?? "");
  index += 1;
  for (let path = 0; path < paths && index < pairs.length; path += 1) {
    while (index < pairs.length && pairs[index]?.code !== 92) {
      index += 1;
    }
    if (index >= pairs.length) {
      break;
    }
    const flag = dxfNum(pairs[index]?.value ?? "");
    index += 1;
    if ((flag & 2) === 2) {
      let hasBulge = false;
      let closed = true;
      while (index < pairs.length && pairs[index]?.code !== 93) {
        if (pairs[index]?.code === 72) {
          hasBulge = dxfNum(pairs[index]?.value ?? "") === 1;
        }
        if (pairs[index]?.code === 73) {
          closed = dxfNum(pairs[index]?.value ?? "") === 1;
        }
        index += 1;
      }
      if (index >= pairs.length) {
        break;
      }
      const count = dxfNum(pairs[index]?.value ?? "");
      index += 1;
      const points: Point[] = [];
      const bulges: number[] = [];
      for (let vertex = 0; vertex < count && index < pairs.length; vertex += 1) {
        let x: number | null = null;
        let y: number | null = null;
        let bulge = 0;
        while (index < pairs.length) {
          const pair = pairs[index];
          if (!pair || pair.code === 92 || pair.code === 93) {
            break;
          }
          index += 1;
          if (pair.code === 10) {
            x = dxfNum(pair.value);
          } else if (pair.code === 20 && x !== null) {
            y = dxfNum(pair.value);
            if (!hasBulge) {
              break;
            }
          } else if (pair.code === 42 && y !== null) {
            bulge = dxfNum(pair.value);
            break;
          }
        }
        if (x !== null && y !== null) {
          points.push({ x, y });
          bulges.push(bulge);
        }
      }
      const shaped = withBulges(points, bulges, closed);
      if (shaped.points.length >= 2) {
        const angle = pairs.find((pair) => pair.code === 52);
        out.push({
          kind: "polyline",
          layer,
          closed: shaped.closed,
          points: shaped.points,
          ...(solid && shaped.closed ? { fill: true } : {}),
          ...(solid || !shaped.closed
            ? {}
            : { pattern: angle ? dxfNum(angle.value) : 45 }),
        });
      }
    } else {
      while (index < pairs.length && pairs[index]?.code !== 93) {
        index += 1;
      }
      if (index >= pairs.length) {
        break;
      }
      const edges = dxfNum(pairs[index]?.value ?? "");
      index += 1;
      for (let edge = 0; edge < edges && index < pairs.length; edge += 1) {
        while (index < pairs.length && pairs[index]?.code !== 72 && pairs[index]?.code !== 92) {
          index += 1;
        }
        if (index >= pairs.length || pairs[index]?.code !== 72) {
          break;
        }
        const type = dxfNum(pairs[index]?.value ?? "");
        index += 1;
        const bag: { code: number; value: string }[] = [];
        while (
          index < pairs.length &&
          pairs[index]?.code !== 72 &&
          pairs[index]?.code !== 92 &&
          pairs[index]?.code !== 97
        ) {
          const pair = pairs[index];
          if (pair) {
            bag.push(pair);
          }
          index += 1;
        }
        const drawn = hatchEdge(type, bag, layer);
        if (drawn) {
          out.push(drawn);
        }
      }
    }
  }
  return out;
}

function hatchEdge(
  type: number,
  pairs: { code: number; value: string }[],
  layer?: string,
): GeomEntity | null {
  const value = (code: number) => dxfNum(pairs.find((pair) => pair.code === code)?.value ?? "");
  if (type === 1) {
    return {
      kind: "line",
      layer,
      a: { x: value(10), y: value(20) },
      b: { x: value(11), y: value(21) },
    };
  }
  if (type === 2) {
    let start = value(50);
    let end = value(51);
    const ccw = pairs.find((pair) => pair.code === 73);
    if (ccw && dxfNum(ccw.value) === 0) {
      const swap = start;
      start = end;
      end = swap;
    }
    return {
      kind: "arc",
      layer,
      c: { x: value(10), y: value(20) },
      r: value(40),
      start,
      end,
    };
  }
  return null;
}

function withBulges(points: Point[], bulges: number[], closed: boolean) {
  const curved = bulges.some((bulge) => Math.abs(bulge) > 1e-8);
  if (!curved || points.length < 2) {
    return { points, closed };
  }
  const verts = points.map((point, index) => ({
    x: point.x,
    y: point.y,
    bulge: bulges[index] ?? 0,
  }));
  if (closed) {
    verts.push({ x: verts[0].x, y: verts[0].y, bulge: 0 });
  }
  const out: Point[] = [];
  for (let i = 0; i < verts.length - 1; i += 1) {
    out.push({ x: verts[i].x, y: verts[i].y });
    if (Math.abs(verts[i].bulge) > 1e-8) {
      out.push(...arcPoints(verts[i], verts[i + 1], verts[i].bulge));
    }
  }
  out.push({ x: verts[verts.length - 1].x, y: verts[verts.length - 1].y });
  const looped =
    closed &&
    out.length > 1 &&
    Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-6;
  return { points: looped ? out.slice(0, -1) : out, closed: looped };
}

function arcPoints(from: Point, to: Point, bulge: number) {
  const theta = Math.atan(Math.abs(bulge)) * 4;
  const start = bulge < 0 ? from : to;
  const end = bulge < 0 ? to : from;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9 || theta < 1e-6) {
    return [];
  }
  const offset = Math.abs(length / 2 / Math.tan(theta / 2));
  const nx = -dy / length;
  const ny = dx / length;
  const side = theta < Math.PI ? -1 : 1;
  const cx = (start.x + end.x) / 2 + nx * offset * side;
  const cy = (start.y + end.y) / 2 + ny * offset * side;
  const fromAngle = Math.atan2(end.y - cy, end.x - cx);
  let toAngle = Math.atan2(start.y - cy, start.x - cx);
  if (toAngle < fromAngle) {
    toAngle += Math.PI * 2;
  }
  const radius = Math.hypot(end.x - cx, end.y - cy);
  const steps = Math.max(4, Math.ceil((toAngle - fromAngle) / (Math.PI / 18)));
  const points: Point[] = [];
  for (let i = 1; i < steps; i += 1) {
    const angle = fromAngle + ((toAngle - fromAngle) * i) / steps;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  if (bulge < 0) {
    points.reverse();
  }
  return points;
}

const STOCK_DASH: Record<string, number[]> = {
  dashed: [12, -6],
  dashed2: [6, -3],
  hidden: [6, -3],
  hidden2: [3, -1.5],
  center: [20, -4, 4, -4],
  center2: [12, -3, 3, -3],
  phantom: [20, -4, 4, -4, 4, -4],
  dot: [0, -6],
  divide: [12, -4, 0, -4, 0, -4],
};

function resolveDash(
  entityType: string,
  layerType: string | undefined,
  defined: Map<string, number[]>,
  scale: number,
) {
  const requested = entityType.trim().toLowerCase();
  const name =
    !requested || requested === "bylayer" ? (layerType ?? "").toLowerCase() : requested;
  if (!name || name === "continuous" || name === "bylayer" || name === "byblock") {
    return undefined;
  }
  const pattern = defined.get(name) ?? STOCK_DASH[name];
  if (!pattern?.length) {
    return undefined;
  }
  const factor = scale > 0 ? scale : 1;
  return pattern.map((part) => part * factor);
}

function textPlacement(
  entity: string,
  insert: Point,
  alignPoint: Point,
  hasAlignPoint: boolean,
  hAlign: number,
  vAlign: number,
  attach: number,
) {
  if (entity === "MTEXT" && attach >= 1 && attach <= 9) {
    const column = (attach - 1) % 3;
    const row = Math.floor((attach - 1) / 3);
    return {
      p: insert,
      align: column === 1 ? ("center" as const) : column === 2 ? ("right" as const) : undefined,
      valign: row === 0 ? ("top" as const) : row === 1 ? ("middle" as const) : undefined,
    };
  }
  const aligned = (hAlign !== 0 || vAlign !== 0) && hasAlignPoint;
  return {
    p: aligned ? alignPoint : insert,
    align:
      hAlign === 1 || hAlign === 4 ? ("center" as const) : hAlign === 2 ? ("right" as const) : undefined,
    valign:
      hAlign === 4 || vAlign === 2 ? ("middle" as const) : vAlign === 3 ? ("top" as const) : undefined,
  };
}

function textAngle(entity: string, rotation: number | null) {
  if (rotation === null || !Number.isFinite(rotation)) {
    return 0;
  }
  const degrees = entity === "MTEXT" ? (rotation * 180) / Math.PI : rotation;
  return Math.abs(degrees) < 1e-6 ? 0 : degrees;
}

function dxfNum(value: string) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function aciColor(entityAci: number | null, layerAci: number | undefined) {
  const picked =
    entityAci === null || Math.abs(entityAci) === 256 ? layerAci : Math.abs(Math.trunc(entityAci));
  if (picked === undefined) {
    return undefined;
  }
  const index = Math.abs(Math.trunc(picked));
  if (index === 0 || index === 7 || index >= 256) {
    return undefined;
  }
  return aciHex(index);
}

function strokeWeight(entityWeight: number | null, layerWeight: number | undefined) {
  const hundredths =
    entityWeight === null || entityWeight === -1
      ? layerWeight
      : entityWeight >= 0
        ? entityWeight
        : undefined;
  if (hundredths === undefined || hundredths < 0) {
    return undefined;
  }
  return Math.min(3.2, Math.max(0.75, hundredths / 30));
}

const ACI_BASIC = [
  "#ff0000",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#ff00ff",
  "#ffffff",
  "#808080",
  "#c0c0c0",
];

const ACI_HUES: ReadonlyArray<readonly [number, number, number]> = [
  [255, 0, 0],
  [255, 63, 0],
  [255, 127, 0],
  [255, 191, 0],
  [255, 255, 0],
  [191, 255, 0],
  [127, 255, 0],
  [63, 255, 0],
  [0, 255, 0],
  [0, 255, 63],
  [0, 255, 127],
  [0, 255, 191],
  [0, 255, 255],
  [0, 191, 255],
  [0, 127, 255],
  [0, 63, 255],
  [0, 0, 255],
  [63, 0, 255],
  [127, 0, 255],
  [191, 0, 255],
  [255, 0, 255],
  [255, 0, 191],
  [255, 0, 127],
  [255, 0, 63],
];

function aciHex(index: number) {
  if (index >= 1 && index <= 9) {
    return ACI_BASIC[index - 1];
  }
  if (index >= 250 && index <= 255) {
    const gray = [51, 91, 132, 173, 214, 255][index - 250];
    return rgbHex(gray, gray, gray);
  }
  if (index < 10 || index > 249) {
    return undefined;
  }
  const group = index - 10;
  const hue = ACI_HUES[Math.floor(group / 10)];
  const scale = [255, 204, 153, 127, 76][Math.floor((group % 10) / 2)];
  const max = Math.max(hue[0], hue[1], hue[2]);
  const tint = group % 2 === 1;
  const scaled = hue.map((channel) =>
    Math.round(((tint && channel === 0 ? max / 2 : channel) * scale) / 255),
  );
  return rgbHex(scaled[0], scaled[1], scaled[2]);
}

function rgbHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function splinePoints(controls: Point[], knots: number[], degree: number) {
  const count = controls.length;
  const p = Math.trunc(degree);
  if (count < 2 || p < 1 || p >= count) {
    return null;
  }
  const u = knots.length >= count + p + 1 ? knots : clampedKnots(count, p);
  const from = u[p];
  const to = u[count];
  if (!Number.isFinite(from) || !Number.isFinite(to) || to - from < 1e-9) {
    return null;
  }
  const steps = Math.max(24, (count - p) * 8);
  const points: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i === steps ? to : from + ((to - from) * i) / steps;
    const point = deBoor(controls, u, p, t);
    if (!point) {
      return null;
    }
    points.push(point);
  }
  return points;
}

function clampedKnots(count: number, degree: number) {
  const knots: number[] = [];
  for (let i = 0; i < count + degree + 1; i += 1) {
    if (i <= degree) {
      knots.push(0);
    } else if (i >= count) {
      knots.push(1);
    } else {
      knots.push((i - degree) / (count - degree));
    }
  }
  return knots;
}

function deBoor(controls: Point[], knots: number[], degree: number, t: number) {
  const count = controls.length;
  let span = count - 1;
  if (t < knots[count] - 1e-12) {
    span = degree;
    while (span < count - 1 && t >= knots[span + 1]) {
      span += 1;
    }
  }
  const d: Point[] = [];
  for (let j = 0; j <= degree; j += 1) {
    const control = controls[span - degree + j];
    if (!control) {
      return null;
    }
    d.push({ x: control.x, y: control.y });
  }
  for (let r = 1; r <= degree; r += 1) {
    for (let j = degree; j >= r; j -= 1) {
      const i = span - degree + j;
      const denom = knots[i + degree - r + 1] - knots[i];
      const alpha = Math.abs(denom) < 1e-12 ? 0 : (t - knots[i]) / denom;
      d[j] = {
        x: (1 - alpha) * d[j - 1].x + alpha * d[j].x,
        y: (1 - alpha) * d[j - 1].y + alpha * d[j].y,
      };
    }
  }
  return d[degree];
}

function isDrawn(entity: GeomEntity) {
  return entity.kind !== "text";
}

function viewportFrom(pairs: { code: number; value: string }[]): SheetViewport | null {
  const num = (code: number, fallback = 0) => {
    const found = pairs.find((pair) => pair.code === code);
    const value = found ? Number.parseFloat(found.value) : Number.NaN;
    return Number.isFinite(value) ? value : fallback;
  };
  const width = num(40);
  const height = num(41);
  const viewH = num(45);
  if (width <= 0 || height <= 0 || viewH <= 0) {
    return null;
  }
  return {
    id: Math.round(num(69, 1)),
    on: Math.round(num(68, 1)) !== 0,
    cx: num(10),
    cy: num(20),
    w: width,
    h: height,
    mx: num(12),
    my: num(22),
    viewH,
    twist: num(51),
  };
}

function composeSheet(
  model: GeomEntity[],
  paper: GeomEntity[],
  viewports: SheetViewport[],
): GeomEntity[] | null {
  const windows = viewports.filter((viewport) => viewport.on && viewport.id !== 1);
  if (!windows.length) {
    return null;
  }
  const framed = model.map((entity) => ({ entity, box: entityBox(entity) }));
  const seen = paper.slice();
  for (const viewport of windows) {
    const viewW = viewport.viewH * (viewport.w / viewport.h);
    const window: Box = {
      minX: viewport.mx - viewW / 2,
      maxX: viewport.mx + viewW / 2,
      minY: viewport.my - viewport.viewH / 2,
      maxY: viewport.my + viewport.viewH / 2,
    };
    const scale = viewport.h / viewport.viewH;
    for (const item of framed) {
      if (!item.box || !overlaps(item.box, window)) {
        continue;
      }
      const clipped = clipToWindow(item.entity, item.box, window);
      if (!clipped) {
        continue;
      }
      seen.push(ontoSheet(clipped, viewport, scale));
    }
  }
  return seen;
}

function ontoSheet(entity: GeomEntity, viewport: SheetViewport, scale: number): GeomEntity {
  const map = (point: Point) => {
    let dx = point.x - viewport.mx;
    let dy = point.y - viewport.my;
    if (viewport.twist) {
      const angle = (-viewport.twist * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx;
      dy = ry;
    }
    return { x: viewport.cx + dx * scale, y: viewport.cy + dy * scale };
  };
  const dash = entity.dash?.map((part) => part * scale);
  const painted = dash ? { ...entity, dash } : entity;
  if (painted.kind === "line") {
    return { ...painted, a: map(painted.a), b: map(painted.b) };
  }
  if (painted.kind === "polyline") {
    return { ...painted, points: painted.points.map(map) };
  }
  if (painted.kind === "text") {
    return {
      ...painted,
      p: map(painted.p),
      height: painted.height * scale,
      ...(painted.width !== undefined ? { width: painted.width * scale } : {}),
      rotation: (painted.rotation ?? 0) - viewport.twist,
    };
  }
  if (painted.kind === "circle") {
    return { ...painted, c: map(painted.c), r: painted.r * scale };
  }
  return {
    ...painted,
    c: map(painted.c),
    r: painted.r * scale,
    start: painted.start - viewport.twist,
    end: painted.end - viewport.twist,
  };
}

function entityBox(entity: GeomEntity): Box | null {
  const points =
    entity.kind === "line"
      ? [entity.a, entity.b]
      : entity.kind === "polyline"
        ? entity.points
        : entity.kind === "text"
          ? [entity.p]
          : [
              { x: entity.c.x - entity.r, y: entity.c.y - entity.r },
              { x: entity.c.x + entity.r, y: entity.c.y + entity.r },
            ];
  return boxOf(points);
}

function boxOf(points: Point[]): Box | null {
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

function overlaps(a: Box, b: Box) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function contains(outer: Box, inner: Box) {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  );
}

function clipToWindow(entity: GeomEntity, box: Box, window: Box): GeomEntity | null {
  if (contains(window, box)) {
    return entity;
  }
  if (entity.kind === "line") {
    const ends = clipSegment(entity.a, entity.b, window);
    return ends ? { ...entity, a: ends[0], b: ends[1] } : null;
  }
  if (entity.kind === "polyline") {
    return clipPolyline(entity, window);
  }
  if (entity.kind === "text") {
    return pointInside(entity.p, window) ? entity : null;
  }
  return null;
}

function clipPolyline(entity: Extract<GeomEntity, { kind: "polyline" }>, window: Box): GeomEntity | null {
  if (entity.closed && (entity.fill || entity.pattern !== undefined)) {
    const points = clipPolygon(entity.points, window);
    return points.length >= 3 ? { ...entity, points, closed: true } : null;
  }
  const points: Point[] = [];
  for (let i = 1; i < entity.points.length; i += 1) {
    const ends = clipSegment(entity.points[i - 1], entity.points[i], window);
    if (!ends) {
      continue;
    }
    if (!points.length || points[points.length - 1].x !== ends[0].x || points[points.length - 1].y !== ends[0].y) {
      points.push(ends[0]);
    }
    points.push(ends[1]);
  }
  return points.length >= 2 ? { ...entity, points, closed: false } : null;
}

function clipPolygon(points: Point[], window: Box) {
  let output = points;
  const edges: { inside: (point: Point) => boolean; cross: (a: Point, b: Point) => Point }[] = [
    {
      inside: (point) => point.x >= window.minX,
      cross: (a, b) => crossAt(a, b, (window.minX - a.x) / (b.x - a.x)),
    },
    {
      inside: (point) => point.x <= window.maxX,
      cross: (a, b) => crossAt(a, b, (window.maxX - a.x) / (b.x - a.x)),
    },
    {
      inside: (point) => point.y >= window.minY,
      cross: (a, b) => crossAt(a, b, (window.minY - a.y) / (b.y - a.y)),
    },
    {
      inside: (point) => point.y <= window.maxY,
      cross: (a, b) => crossAt(a, b, (window.maxY - a.y) / (b.y - a.y)),
    },
  ];
  for (const edge of edges) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i += 1) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      const currentIn = edge.inside(current);
      const previousIn = edge.inside(previous);
      if (currentIn) {
        if (!previousIn) {
          output.push(edge.cross(previous, current));
        }
        output.push(current);
      } else if (previousIn) {
        output.push(edge.cross(previous, current));
      }
    }
  }
  return output;
}

function crossAt(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function clipSegment(a: Point, b: Point, window: Box): [Point, Point] | null {
  let ax = a.x;
  let ay = a.y;
  let bx = b.x;
  let by = b.y;
  let codeA = outCode(ax, ay, window);
  let codeB = outCode(bx, by, window);
  for (let step = 0; step < 8; step += 1) {
    if ((codeA | codeB) === 0) {
      return [
        { x: ax, y: ay },
        { x: bx, y: by },
      ];
    }
    if ((codeA & codeB) !== 0) {
      return null;
    }
    const outside = codeA || codeB;
    let x = 0;
    let y = 0;
    if (outside & 8) {
      x = ax + ((bx - ax) * (window.maxY - ay)) / (by - ay);
      y = window.maxY;
    } else if (outside & 4) {
      x = ax + ((bx - ax) * (window.minY - ay)) / (by - ay);
      y = window.minY;
    } else if (outside & 2) {
      y = ay + ((by - ay) * (window.maxX - ax)) / (bx - ax);
      x = window.maxX;
    } else {
      y = ay + ((by - ay) * (window.minX - ax)) / (bx - ax);
      x = window.minX;
    }
    if (outside === codeA) {
      ax = x;
      ay = y;
      codeA = outCode(ax, ay, window);
    } else {
      bx = x;
      by = y;
      codeB = outCode(bx, by, window);
    }
  }
  return null;
}

function outCode(x: number, y: number, window: Box) {
  let code = 0;
  if (x < window.minX) {
    code |= 1;
  } else if (x > window.maxX) {
    code |= 2;
  }
  if (y < window.minY) {
    code |= 4;
  } else if (y > window.maxY) {
    code |= 8;
  }
  return code;
}

function pointInside(point: Point, window: Box) {
  return (
    point.x >= window.minX &&
    point.x <= window.maxX &&
    point.y >= window.minY &&
    point.y <= window.maxY
  );
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
      ...(entity.width !== undefined ? { width: entity.width * Math.abs(insert.sx || 1) } : {}),
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
    .replace(/\\[Pp];?/g, "\n")
    .replace(/\\~/g, " ")
    .replace(/\\[A-Za-z][^;]*;/g, "")
    .replace(/[{}]/g, "")
    .replace(/%%[UuOo]/g, "");
}
