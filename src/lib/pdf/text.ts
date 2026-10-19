export type PdfGlyph = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  hasEOL?: boolean;
};

export type PdfLine = {
  value: string;
  x: number;
  y: number;
  height: number;
};

/** CAD plots often emit one glyph per Tj. Join those back into readable notes. */
export function reconstructPdfLines(items: PdfGlyph[]): PdfLine[] {
  const glyphs = items
    .map((item) => ({
      str: item.str,
      x: item.x,
      y: item.y,
      width: item.width || 0,
      height: item.height || item.fontSize || 12,
      fontSize: item.fontSize || item.height || 12,
      hasEOL: item.hasEOL,
    }))
    .filter((item) => item.str.length);

  glyphs.sort((a, b) => {
    const tol = Math.max(a.height, b.height, 4) * 0.5;
    if (Math.abs(a.y - b.y) > tol) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const bands: PdfGlyph[][] = [];
  for (const glyph of glyphs) {
    const band = bands[bands.length - 1];
    const prev = band?.[band.length - 1];
    const tol = Math.max(prev?.height ?? 0, glyph.height, 4) * 0.55;
    if (!band || !prev || Math.abs(glyph.y - prev.y) > tol || prev.hasEOL) {
      bands.push([glyph]);
      continue;
    }
    band.push(glyph);
  }

  const lines: PdfLine[] = [];
  for (const band of bands) {
    band.sort((a, b) => a.x - b.x);
    for (const run of splitRuns(band)) {
      const value = joinRun(run);
      if (value) {
        lines.push({
          value,
          x: run[0].x,
          y: run[0].y,
          height: Math.max(...run.map((item) => item.height)),
        });
      }
    }
  }
  return lines;
}

export function uniqueLines(values: string[]) {
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

function splitRuns(glyphs: PdfGlyph[]) {
  const runs: PdfGlyph[][] = [];
  let current: PdfGlyph[] = [];
  for (const glyph of glyphs) {
    const prev = current[current.length - 1];
    if (!prev) {
      current = [glyph];
      continue;
    }
    const gap = glyph.x - (prev.x + prev.width);
    const size = Math.max(prev.fontSize, glyph.fontSize, 8);
    if (gap > size * 2.2) {
      runs.push(current);
      current = [glyph];
      continue;
    }
    current.push(glyph);
  }
  if (current.length) {
    runs.push(current);
  }
  return runs;
}

function joinRun(glyphs: PdfGlyph[]) {
  let text = "";
  for (let i = 0; i < glyphs.length; i += 1) {
    const glyph = glyphs[i];
    if (i > 0) {
      const prev = glyphs[i - 1];
      const gap = glyph.x - (prev.x + prev.width);
      const size = Math.max(prev.fontSize, glyph.fontSize, 8);
      const spaced = / $/.test(text) || /^\s/.test(glyph.str);
      if (gap > size * 0.32 && !spaced) {
        text += " ";
      }
    }
    text += glyph.str;
  }
  return text.replace(/\s+/g, " ").trim();
}
