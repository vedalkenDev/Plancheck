export type DrawingText = {
  kind: "text" | "mtext" | "attrib" | "block" | "layer" | "string";
  value: string;
  layer?: string;
  tag?: string;
};

export type DrawingExtract = {
  format: "dxf" | "dwg" | "unknown";
  texts: DrawingText[];
  strings: string[];
  entityCounts: Record<string, number>;
};

const JUNK =
  /^(ACAD|ACDB|AutoCAD|AppId|DIMSTYLE|LTYPE|Continuous|ByLayer|ByBlock|Defpoints|HANDSEED|ObjectDBX|AcDb|SHX|ttf|Annotative|Viewport|MVIEW|Standard|Romans|Arial|ISO|ANSI|Header|CLASSES|ENTITIES|TABLES|BLOCKS|EOF|SECTION|ENDSEC|SEQEND|VERTEX|EXTENDED)/i;

const HEX = /^[0-9A-Fa-f]{8,}$/;

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

function parseDxf(content: string): DrawingExtract {
  const lines = content.split(/\r?\n/);
  const texts: DrawingText[] = [];
  const entityCounts: Record<string, number> = {};
  let entity = "";
  let value = "";
  let extra = "";
  let layer = "";
  let tag = "";

  function flush() {
    const combined = stripDxfMarkup(`${value}${extra}`).trim();
    if (
      combined &&
      (entity === "TEXT" ||
        entity === "MTEXT" ||
        entity === "ATTRIB" ||
        entity === "ATTDEF")
    ) {
      texts.push({
        kind: entity === "MTEXT" ? "mtext" : entity === "TEXT" ? "text" : "attrib",
        value: combined,
        layer: layer || undefined,
        tag: tag || undefined,
      });
    } else if (entity === "INSERT" && tag) {
      texts.push({ kind: "block", value: tag });
    } else if (entity === "LAYER" && tag) {
      texts.push({ kind: "layer", value: tag });
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
      flush();
      entity = raw.trim();
      entityCounts[entity] = (entityCounts[entity] ?? 0) + 1;
      value = "";
      extra = "";
      layer = "";
      tag = "";
      continue;
    }

    if (code === 1) {
      value = raw;
    } else if (code === 3) {
      extra += raw;
    } else if (code === 8) {
      layer = raw.trim();
    } else if (code === 2) {
      tag = raw.trim();
    }
  }
  flush();

  return {
    format: "dxf",
    texts,
    strings: uniqueStrings(texts.map((item) => item.value)),
    entityCounts,
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
