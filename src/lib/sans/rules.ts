import type { FailedCheck, PassedCheck } from "@/data/types";
import type { DrawingExtract } from "@/lib/cad/extract";
import { occupancyFromText } from "@/lib/sans/occupancy";

const ADDRESS =
  /\b(\d{1,5})\s+([A-Za-z][A-Za-z]+(?:\s+[A-Za-z][A-Za-z]+){0,3}\s+(?:Road|Rd|Drive|Dr|Street|St|Avenue|Ave|Lane|Ln|Way|Crescent|Close))\b/gi;
const FENESTRATION = /fenestr|glaz|window|l\/g|xa\s*4|sans 204|not required/i;

export type AuditContext = {
  filename: string;
  extract: DrawingExtract;
  blob: string;
  occupancy: string;
  occupancyNote: string;
  addresses: { number: string; street: string; full: string }[];
};

type RuleResult =
  | { status: "skip" }
  | { status: "pass"; detail: string; evidence?: FailedCheck["evidence"] }
  | {
      status: "fail";
      detail: string;
      adjust: string;
      evidence?: FailedCheck["evidence"];
    };

type Rule = {
  id: string;
  part: string;
  check: string;
  run: (ctx: AuditContext) => RuleResult;
};

export const SANS_RULES: Rule[] = [
  {
    id: "readable-text",
    part: "A",
    check: "Readable drawing text",
    run: (ctx) => {
      if (ctx.extract.strings.length >= 8) {
        return { status: "skip" };
      }
      return {
        status: "fail",
        detail: "Very little readable title or note text on this drawing",
        adjust:
          "Export the drawing from your CAD software and upload that so Plancheck can read titles, notes, and schedules.",
      };
    },
  },
  {
    id: "occupancy",
    part: "A",
    check: "Occupancy",
    run: (ctx) => {
      if (ctx.occupancy === "—") {
        return {
          status: "fail",
          detail: "Occupancy class not found",
          adjust:
            "Mark the occupancy on the titleblock (for example H4 dwelling or G1 offices).",
        };
      }
      return {
        status: "pass",
        detail: `${ctx.occupancy} · ${ctx.occupancyNote}`,
        evidence: quotes(ctx, new RegExp(`\\b${ctx.occupancy}\\b`, "i")),
      };
    },
  },
  {
    id: "address",
    part: "A",
    check: "Street address",
    run: (ctx) => {
      if (ctx.addresses.length === 0) {
        return {
          status: "fail",
          detail: "No street address found",
          adjust:
            "Put one consistent address on the titleblock, application, and drawings.",
        };
      }
      const streets = new Map<string, Set<string>>();
      for (const item of ctx.addresses) {
        const key = item.street.toLowerCase();
        const set = streets.get(key) ?? new Set<string>();
        set.add(item.number);
        streets.set(key, set);
      }
      const conflict = [...streets.entries()].find(([, numbers]) => numbers.size > 1);
      if (conflict) {
        const [street, numbers] = conflict;
        const label = `${[...numbers].join(" vs ")} ${titleStreet(street)}`;
        return {
          status: "fail",
          detail: label,
          adjust: `Resolve ${label} across titleblock, application, and drawings so the address is consistent.`,
          evidence: ctx.addresses.map((item) => ({ quote: item.full })),
        };
      }
      return {
        status: "pass",
        detail: ctx.addresses[0].full,
        evidence: [{ quote: ctx.addresses[0].full }],
      };
    },
  },
  {
    id: "titleblocks",
    part: "A",
    check: "Titleblocks",
    run: (ctx) => {
      const titles = ctx.extract.texts.filter((line) =>
        /proposed|titleblock|title block/i.test(line.value),
      );
      const unique = [...new Set(titles.map((line) => line.value.toLowerCase()))];
      if (unique.length > 1) {
        return {
          status: "fail",
          detail: "More than one project title on the set",
          adjust: "Replace leftover titleblocks so every sheet matches this project.",
          evidence: titles.slice(0, 4).map((line) => ({
            quote: line.value,
            layer: line.layer,
          })),
        };
      }
      if (!titles.length) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        detail: "One project title found",
        evidence: [{ quote: titles[0].value, layer: titles[0].layer }],
      };
    },
  },
  {
    id: "xa-fenestration",
    part: "XA",
    check: "XA fenestration",
    run: (ctx) => xaFenestration(ctx),
  },
  {
    id: "window-schedule",
    part: "N",
    check: "Window schedule",
    run: (ctx) => {
      const types = findWindowTypes(ctx.blob);
      const hasSchedule = /window schedule/i.test(ctx.blob) || types.length > 0;
      const hasWindows = /window|fenestr|glaz/i.test(ctx.blob);

      if (hasSchedule && types.length) {
        const span =
          types.length === 1
            ? types[0]
            : `${types[0]}–${types[types.length - 1]}`;
        return {
          status: "pass",
          detail: `${span} with unit sizes drawn`,
          evidence: quotes(ctx, /window schedule|W\d{1,2}/i),
        };
      }
      if (hasSchedule) {
        return {
          status: "pass",
          detail: "Present",
          evidence: quotes(ctx, /window schedule/i),
        };
      }
      if (!hasWindows) {
        return { status: "skip" };
      }
      return {
        status: "fail",
        detail: "Window types and pane sizes not found",
        adjust:
          "Add a window schedule with type elevations — overall size and each pane — in free space on the sheet.",
      };
    },
  },
  {
    id: "part-r",
    part: "R",
    check: "Stormwater",
    run: (ctx) => {
      if (/soak\s*pit|stormwater|storm water/i.test(ctx.blob)) {
        return {
          status: "pass",
          detail: "Soakpit / stormwater noted",
          evidence: quotes(ctx, /soak\s*pit|stormwater|storm water/i),
        };
      }
      return {
        status: "fail",
        detail: "Stormwater / soakpit missing",
        adjust: "Add Part R stormwater / soakpit information to the set.",
      };
    },
  },
  {
    id: "part-m",
    part: "M",
    check: "Stairs",
    run: (ctx) => {
      const hasStair = /stair/i.test(ctx.blob);
      const hasDims = /\b\d+(\.\d+)?\s*(mm|m)\b/i.test(ctx.blob) && hasStair;
      if (hasStair && hasDims) {
        return {
          status: "pass",
          detail: "Part M dimensions noted",
          evidence: quotes(ctx, /stair/i),
        };
      }
      return {
        status: "fail",
        detail: hasStair ? "Stair dims missing" : "Stair dimensions not found",
        adjust: "Dimension stairs to Part M on the drawings.",
        evidence: hasStair ? quotes(ctx, /stair/i) : undefined,
      };
    },
  },
  {
    id: "part-d",
    part: "D",
    check: "Pool enclosure",
    run: (ctx) => {
      if (!/pool|swimming/i.test(ctx.blob)) {
        return { status: "skip" };
      }
      const hasHeight = /1\s*[.,]?\s*2\s*m|1200\s*mm/i.test(ctx.blob);
      const hasGap = /100\s*mm/i.test(ctx.blob);
      const hasGate = /self[-\s]?clos/i.test(ctx.blob);
      if (/enclos/i.test(ctx.blob) && hasHeight && hasGap && hasGate) {
        return {
          status: "pass",
          detail: "Part D enclosure noted (≥1.2 m / 100 mm / self-closing gate)",
          evidence: quotes(ctx, /enclos|1\s*[.,]?\s*2|100\s*mm|self[-\s]?clos/i),
        };
      }
      return {
        status: "fail",
        detail: "Part D enclosure missing",
        adjust:
          "Add a Part D pool enclosure: barrier at least 1.2 m high, openings not more than 100 mm, and a self-closing / self-latching gate.",
        evidence: quotes(ctx, /pool|swimming/i),
      };
    },
  },
  {
    id: "part-k",
    part: "K",
    check: "Walls",
    run: (ctx) => {
      if (!/part\s*k|boundary wall/i.test(ctx.blob)) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        detail: "Boundary wall noted",
        evidence: quotes(ctx, /part\s*k|boundary wall/i),
      };
    },
  },
  {
    id: "part-s",
    part: "S",
    check: "Disabled access",
    run: (ctx) => {
      if (!/part\s*s|disabled|accessib|ramp|wheelchair/i.test(ctx.blob)) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        detail: "Access notes found",
        evidence: quotes(ctx, /part\s*s|disabled|accessib|ramp|wheelchair/i),
      };
    },
  },
  {
    id: "part-t",
    part: "T",
    check: "Fire protection",
    run: (ctx) => {
      if (!/part\s*t|fire escape|fire protection|hose reel|emergency exit/i.test(ctx.blob)) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        detail: "Fire notes found",
        evidence: quotes(ctx, /part\s*t|fire escape|fire protection|hose reel|emergency exit/i),
      };
    },
  },
  {
    id: "part-o",
    part: "O",
    check: "Lighting",
    run: (ctx) => {
      if (/w\s*\/\s*m/i.test(ctx.blob) || /lighting/i.test(ctx.blob)) {
        return {
          status: "pass",
          detail: /w\s*\/\s*m/i.test(ctx.blob) ? "W/m² noted" : "Lighting noted",
          evidence: quotes(ctx, /lighting|w\s*\/\s*m/i),
        };
      }
      return { status: "skip" };
    },
  },
  {
    id: "parking",
    part: "Zoning",
    check: "Parking",
    run: (ctx) => {
      const match = ctx.blob.match(/parking[^\n]{0,48}/i);
      if (!match) {
        return { status: "skip" };
      }
      if (
        /\d+\s*\/\s*\d+|\d+\s*(bays|provided)/i.test(match[0]) ||
        /\d+/.test(match[0])
      ) {
        return {
          status: "pass",
          detail: match[0].replace(/\s+/g, " ").trim(),
          evidence: [{ quote: match[0].replace(/\s+/g, " ").trim() }],
        };
      }
      return { status: "skip" };
    },
  },
  {
    id: "coverage",
    part: "Zoning",
    check: "Coverage",
    run: (ctx) => {
      const match = ctx.blob.match(/coverage[^\n]{0,40}/i);
      if (!match) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        detail: match[0].replace(/\s+/g, " ").trim(),
        evidence: [{ quote: match[0].replace(/\s+/g, " ").trim() }],
      };
    },
  },
  {
    id: "site-area",
    part: "A",
    check: "Site area",
    run: (ctx) => {
      const match = ctx.blob.match(/site\s*area[^\n]{0,32}/i);
      if (!match) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        detail: match[0].replace(/\s+/g, " ").trim(),
        evidence: [{ quote: match[0].replace(/\s+/g, " ").trim() }],
      };
    },
  },
  {
    id: "signatures",
    part: "A19",
    check: "Signatures",
    run: (ctx) => {
      const sigLines = ctx.extract.texts.filter((line) =>
        /signatur|signed|competent person|owner signature/i.test(line.value),
      );
      const named = sigLines.some((line) => hasSignedName(line.value));
      if (named && !/blank|unsigned/i.test(ctx.blob)) {
        return {
          status: "pass",
          detail: "Name found near signature fields",
          evidence: sigLines.slice(0, 3).map((line) => ({
            quote: line.value,
            layer: line.layer,
          })),
        };
      }
      return {
        status: "fail",
        detail: sigLines.length ? "Blank" : "Not found on the drawing",
        adjust: "Obtain owner and competent-person signatures.",
        evidence: sigLines.slice(0, 3).map((line) => ({
          quote: line.value,
          layer: line.layer,
        })),
      };
    },
  },
  {
    id: "eng-packs",
    part: "A19",
    check: "Engineering packs",
    run: (ctx) => {
      if (!/engineer/i.test(ctx.blob)) {
        return { status: "skip" };
      }
      if (/attach|outstanding|to follow|to submit/i.test(ctx.blob)) {
        return {
          status: "fail",
          detail: "To attach",
          adjust: "Attach the outstanding engineering packs to the submission.",
          evidence: quotes(ctx, /engineer/i),
        };
      }
      return {
        status: "pass",
        detail: "Engineering noted",
        evidence: quotes(ctx, /engineer/i),
      };
    },
  },
];

function xaFenestration(ctx: AuditContext): RuleResult {
  const storeys = parseStoreyFenestration(ctx.blob);
  const mentionsXa = /xa/i.test(ctx.blob);
  const mentions204 = /sans\s*204/i.test(ctx.blob);
  const usedTwenty =
    /under\s*20|below\s*20|less than\s*20/i.test(ctx.blob) &&
    /not required/i.test(ctx.blob);
  const evidence = quotes(ctx, FENESTRATION).slice(0, 6);
  const over = storeys.filter((row) => row.percent > 15);

  if (over.length) {
    if (mentions204 && !/not required/i.test(ctx.blob)) {
      return {
        status: "pass",
        detail: `${over.map((row) => `${row.storey} ${row.percent}%`).join(", ")} — SANS 204 noted`,
        evidence,
      };
    }
    const cuts = over.map((row) => describeCut(row)).filter(Boolean);
    const listing = over
      .map((row) => `${row.storey} ${row.percent}%`)
      .join(" and ");
    return {
      status: "fail",
      detail: `${listing} exceed 15%. SANS 204 required.`,
      adjust: cuts.length
        ? `Apply SANS 204, or cut about ${cuts.join(" and ")} of glazing to get each storey to 15% of nett floor. Do not treat “under 20%” as XA not required.`
        : "Apply SANS 204, or reduce glazed area to 15% of nett floor per storey. Do not treat “under 20%” as XA not required.",
      evidence,
    };
  }

  if ((mentionsXa || /fenestr/i.test(ctx.blob)) && storeys.length === 0) {
    return {
      status: "fail",
      detail: "Fenestration % missing",
      adjust:
        "Complete XA 4.4.4 with fenestration percentages per storey (glazed area ÷ nett floor). If a storey is over 15%, SANS 204 is required.",
      evidence,
    };
  }

  if (!mentionsXa && !/fenestr|glaz/i.test(ctx.blob)) {
    return {
      status: "fail",
      detail: "Not found on the drawing",
      adjust:
        "Add fenestration percentages per storey on the XA sheet. If they exceed 15% of nett floor, SANS 204 is required.",
    };
  }

  if (usedTwenty) {
    return {
      status: "fail",
      detail: "XA marked not required using a 20% threshold",
      adjust:
        "Use 15% of nett floor per storey. Over 15% is SANS 204 — never “under 20% so XA not required.”",
      evidence,
    };
  }

  return {
    status: "pass",
    detail: storeys.length
      ? storeys.map((row) => `${row.storey} ${row.percent}%`).join(", ")
      : "Noted on the drawing (≤15% path)",
    evidence,
  };
}

type StoreyFen = {
  storey: string;
  percent: number;
  floorM2?: number;
};

function parseStoreyFenestration(blob: string): StoreyFen[] {
  const found: StoreyFen[] = [];
  for (const match of blob.matchAll(
    /(L\/G|Lower\s*ground|Ground|First|Second|LG)\D{0,28}(\d+(?:\.\d+)?)\s*%/gi,
  )) {
    found.push({
      storey: normalizeStorey(match[1]),
      percent: Number.parseFloat(match[2]),
    });
  }

  for (const row of found) {
    const floor = matchFloor(blob, row.storey);
    if (floor) {
      row.floorM2 = floor;
    }
  }

  return found;
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

function describeCut(row: StoreyFen) {
  if (!row.floorM2 || row.percent <= 15) {
    return "";
  }
  const cut = ((row.percent - 15) / 100) * row.floorM2;
  return `${cut.toFixed(2)} m² (${row.storey})`;
}

function normalizeStorey(value: string) {
  const text = value.replace(/\s+/g, " ").trim().toLowerCase();
  if (text === "lg" || text.startsWith("lower")) {
    return "L/G";
  }
  if (text === "l/g") {
    return "L/G";
  }
  return value.replace(/\s+/g, " ").replace(/^./, (char) => char.toUpperCase());
}

function findWindowTypes(blob: string) {
  const found: string[] = [];
  for (const match of blob.matchAll(/\bW(\d{1,2})\b/g)) {
    const label = `W${match[1]}`;
    if (!found.includes(label)) {
      found.push(label);
    }
  }
  return found;
}

export function evaluateRules(ctx: AuditContext) {
  const passed: PassedCheck[] = [];
  const failed: FailedCheck[] = [];

  for (const rule of SANS_RULES) {
    const result = rule.run(ctx);
    if (result.status === "skip") {
      continue;
    }
    if (result.status === "pass") {
      passed.push({
        id: rule.id,
        part: rule.part,
        check: rule.check,
        detail: result.detail,
        status: "pass",
        evidence: result.evidence,
      });
      continue;
    }
    failed.push({
      id: rule.id,
      part: rule.part,
      check: rule.check,
      detail: result.detail,
      status: "fail",
      adjust: result.adjust,
      evidence: result.evidence,
    });
  }

  return { passed, failed };
}

function quotes(ctx: AuditContext, pattern: RegExp) {
  return ctx.extract.texts
    .filter((line) => pattern.test(line.value))
    .slice(0, 4)
    .map((line) => ({ quote: line.value, layer: line.layer }));
}

function hasSignedName(value: string) {
  if (/blank|unsigned|signature/i.test(value) && !/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(value)) {
    return false;
  }
  const names = value.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) ?? [];
  return names.some(
    (name) => !/owner|signature|competent|person|blank/i.test(name),
  );
}

export function findAddresses(blob: string) {
  const found: { number: string; street: string; full: string }[] = [];
  for (const match of blob.matchAll(ADDRESS)) {
    found.push({
      number: match[1],
      street: match[2].replace(/\s+/g, " ").trim(),
      full: match[0].replace(/\s+/g, " ").trim(),
    });
  }
  return found;
}

function titleStreet(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function occupancyOf(extract: DrawingExtract) {
  return occupancyFromText(extract.strings.join("\n"));
}
