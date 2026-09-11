import type { FailedCheck, PassedCheck } from "@/data/types";
import type { DrawingExtract } from "@/lib/cad/extract";
import {
  needsAccessPartS,
  needsFirePartT,
  occupancyFromText,
} from "@/lib/sans/occupancy";

const ADDRESS =
  /\b(\d{1,5})\s+([A-Za-z][A-Za-z]+(?:\s+[A-Za-z][A-Za-z]+){0,3}\s+(?:Road|Rd|Drive|Dr|Street|St|Avenue|Ave|Lane|Ln|Way|Crescent|Close))\b/gi;
const PERCENT = /(\d{1,2}(?:\.\d+)?)\s*%/g;
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
  | { status: "pass"; note: string; evidence?: FailedCheck["evidence"] }
  | {
      status: "fail";
      note: string;
      adjustment: string;
      evidence?: FailedCheck["evidence"];
    };

type Rule = {
  id: string;
  code: string;
  check: string;
  run: (ctx: AuditContext) => RuleResult;
};

export const SANS_RULES: Rule[] = [
  {
    id: "readable-text",
    code: "NBR A2",
    check: "Readable drawing text",
    run: (ctx) => {
      if (ctx.extract.strings.length >= 8) {
        return { status: "skip" };
      }
      return {
        status: "fail",
        note:
          ctx.extract.format === "dwg"
            ? "Very little readable title or note text in this .dwg"
            : "Very little readable text in this file",
        adjustment:
          "Save a DXF from your CAD software and upload that, so Plancheck can read titles, notes, and schedules.",
      };
    },
  },
  {
    id: "occupancy",
    code: "SANS 10400-A / A20",
    check: "Occupancy classification",
    run: (ctx) => {
      if (ctx.occupancy === "—") {
        return {
          status: "fail",
          note: "Occupancy class not found",
          adjustment:
            "Mark the occupancy on the titleblock (Regulation A20), e.g. H4 dwelling or G1 offices.",
        };
      }
      return {
        status: "pass",
        note: `${ctx.occupancy} · ${ctx.occupancyNote}`,
        evidence: quotes(ctx, new RegExp(`\\b${ctx.occupancy}\\b`, "i")),
      };
    },
  },
  {
    id: "address",
    code: "SANS 10400-A Form 1",
    check: "Street address",
    run: (ctx) => {
      if (ctx.addresses.length === 0) {
        return {
          status: "fail",
          note: "No street address found",
          adjustment:
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
          note: label,
          adjustment: `Resolve ${label} across titleblock, application, and drawings so the address is consistent.`,
          evidence: ctx.addresses.map((item) => ({ quote: item.full })),
        };
      }
      return {
        status: "pass",
        note: ctx.addresses[0].full,
        evidence: [{ quote: ctx.addresses[0].full }],
      };
    },
  },
  {
    id: "titleblocks",
    code: "SANS 10400-A Form 1",
    check: "Titleblocks",
    run: (ctx) => {
      const titles = ctx.extract.texts.filter((line) =>
        /proposed|titleblock|title block/i.test(line.value),
      );
      const unique = [...new Set(titles.map((line) => line.value.toLowerCase()))];
      if (unique.length > 1) {
        return {
          status: "fail",
          note: "More than one project title on the set",
          adjustment:
            "Replace leftover titleblocks so every sheet matches this project.",
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
        note: "One project title found",
        evidence: [{ quote: titles[0].value, layer: titles[0].layer }],
      };
    },
  },
  {
    id: "xa-fenestration",
    code: "SANS 10400-XA 4.4.4",
    check: "XA fenestration",
    run: (ctx) => {
      const related = ctx.extract.strings.filter((line) => FENESTRATION.test(line));
      const percents = findPercents(related.join("\n") || ctx.blob);
      const over = percents.filter((value) => value > 15);
      const mentionsXa = /xa/i.test(ctx.blob);
      const mentions204 = /sans\s*204/i.test(ctx.blob);
      const saysNotRequired = /not required/i.test(ctx.blob);
      const evidence = quotes(ctx, FENESTRATION).slice(0, 4);

      if (over.length && (saysNotRequired || !mentions204)) {
        return {
          status: "fail",
          note: `Glazing at ${over.map((value) => `${value}%`).join(" and ")} exceed 15%. SANS 204 required.`,
          adjustment:
            "Recalculate fenestration. Where the glazed area is over 15%, do not leave XA as “not required”; SANS 204 is required.",
          evidence,
        };
      }
      if ((mentionsXa || /fenestr/i.test(ctx.blob)) && percents.length === 0) {
        return {
          status: "fail",
          note: "Fenestration % missing",
          adjustment:
            "Complete XA 4.4.4 with fenestration percentages. The field is missing.",
          evidence,
        };
      }
      if (!mentionsXa && !/fenestr|glaz/i.test(ctx.blob)) {
        return {
          status: "fail",
          note: "Not found on the drawing",
          adjustment:
            "Add fenestration percentages to the XA sheet. If they exceed 15%, mark SANS 204 as required.",
        };
      }
      return {
        status: "pass",
        note: percents.length
          ? percents.map((value) => `${value}%`).join(", ")
          : "Noted on the drawing",
        evidence,
      };
    },
  },
  {
    id: "part-r",
    code: "SANS 10400-R",
    check: "Stormwater",
    run: (ctx) => {
      if (/soak\s*pit|stormwater|storm water/i.test(ctx.blob)) {
        return {
          status: "pass",
          note: "Soakpit / stormwater noted",
          evidence: quotes(ctx, /soak\s*pit|stormwater|storm water/i),
        };
      }
      return {
        status: "fail",
        note: "Stormwater / soakpit missing",
        adjustment: "Add Part R stormwater / soakpit information to the set.",
      };
    },
  },
  {
    id: "part-m",
    code: "SANS 10400-M",
    check: "Stairs",
    run: (ctx) => {
      const hasStair = /stair/i.test(ctx.blob);
      const hasDims = /\b\d+(\.\d+)?\s*(mm|m)\b/i.test(ctx.blob) && hasStair;
      if (hasStair && hasDims) {
        return {
          status: "pass",
          note: "Part M dimensions noted",
          evidence: quotes(ctx, /stair/i),
        };
      }
      return {
        status: "fail",
        note: hasStair ? "Stair dims missing" : "Stair dimensions not found",
        adjustment: "Dimension stairs to Part M on the drawings.",
        evidence: hasStair ? quotes(ctx, /stair/i) : undefined,
      };
    },
  },
  {
    id: "part-d",
    code: "SANS 10400-D",
    check: "Pool enclosure",
    run: (ctx) => {
      if (!/pool|swimming/i.test(ctx.blob)) {
        return { status: "skip" };
      }
      if (/enclos/i.test(ctx.blob)) {
        return {
          status: "pass",
          note: "Part D enclosure noted",
          evidence: quotes(ctx, /enclos/i),
        };
      }
      return {
        status: "fail",
        note: "Part D enclosure missing",
        adjustment: "Add Part D swimming pool enclosure details to the drawing set.",
        evidence: quotes(ctx, /pool|swimming/i),
      };
    },
  },
  {
    id: "part-k",
    code: "SANS 10400-K",
    check: "Walls",
    run: (ctx) => {
      if (!/part\s*k|boundary wall/i.test(ctx.blob)) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        note: "Boundary wall noted",
        evidence: quotes(ctx, /part\s*k|boundary wall/i),
      };
    },
  },
  {
    id: "part-s",
    code: "SANS 10400-S",
    check: "Disabled access",
    run: (ctx) => {
      if (!needsAccessPartS(ctx.occupancy)) {
        return { status: "skip" };
      }
      if (/part\s*s|disabled|accessib|ramp|wheelchair/i.test(ctx.blob)) {
        return {
          status: "pass",
          note: "Access notes found",
          evidence: quotes(ctx, /part\s*s|disabled|accessib|ramp|wheelchair/i),
        };
      }
      return {
        status: "fail",
        note: "Part S access not found",
        adjustment:
          "Show Part S facilities for persons with disabilities (routes, ramps, sanitary) on this occupancy.",
      };
    },
  },
  {
    id: "part-t",
    code: "SANS 10400-T",
    check: "Fire protection",
    run: (ctx) => {
      if (!needsFirePartT(ctx.occupancy)) {
        return { status: "skip" };
      }
      if (/part\s*t|fire escape|fire protection|hose reel|emergency exit/i.test(ctx.blob)) {
        return {
          status: "pass",
          note: "Fire notes found",
          evidence: quotes(ctx, /part\s*t|fire escape|fire protection|hose reel|emergency exit/i),
        };
      }
      return {
        status: "fail",
        note: "Part T fire notes not found",
        adjustment:
          "Add Part T fire protection / escape notes required for this occupancy.",
      };
    },
  },
  {
    id: "part-o",
    code: "SANS 10400-O",
    check: "Lighting",
    run: (ctx) => {
      if (/w\s*\/\s*m/i.test(ctx.blob) || /lighting/i.test(ctx.blob)) {
        return {
          status: "pass",
          note: /w\s*\/\s*m/i.test(ctx.blob) ? "W/m² noted" : "Lighting noted",
          evidence: quotes(ctx, /lighting|w\s*\/\s*m/i),
        };
      }
      return { status: "skip" };
    },
  },
  {
    id: "parking",
    code: "Zoning / SANS 10400-A",
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
          note: match[0].replace(/\s+/g, " ").trim(),
          evidence: [{ quote: match[0].replace(/\s+/g, " ").trim() }],
        };
      }
      return { status: "skip" };
    },
  },
  {
    id: "coverage",
    code: "Zoning scheme",
    check: "Coverage",
    run: (ctx) => {
      const match = ctx.blob.match(/coverage[^\n]{0,40}/i);
      if (!match) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        note: match[0].replace(/\s+/g, " ").trim(),
        evidence: [{ quote: match[0].replace(/\s+/g, " ").trim() }],
      };
    },
  },
  {
    id: "site-area",
    code: "SANS 10400-A Form 1",
    check: "Site area",
    run: (ctx) => {
      const match = ctx.blob.match(/site\s*area[^\n]{0,32}/i);
      if (!match) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        note: match[0].replace(/\s+/g, " ").trim(),
        evidence: [{ quote: match[0].replace(/\s+/g, " ").trim() }],
      };
    },
  },
  {
    id: "window-schedule",
    code: "SANS 10400-N / A2",
    check: "Window schedule",
    run: (ctx) => {
      if (!/window schedule/i.test(ctx.blob)) {
        return { status: "skip" };
      }
      return {
        status: "pass",
        note: "Present",
        evidence: quotes(ctx, /window schedule/i),
      };
    },
  },
  {
    id: "signatures",
    code: "NBR A19 / Form 1",
    check: "Signatures",
    run: (ctx) => {
      const sigLines = ctx.extract.texts.filter((line) =>
        /signatur|signed|competent person|owner signature/i.test(line.value),
      );
      const named = sigLines.some((line) => hasSignedName(line.value));
      if (named && !/blank|unsigned/i.test(ctx.blob)) {
        return {
          status: "pass",
          note: "Name found near signature fields",
          evidence: sigLines.slice(0, 3).map((line) => ({
            quote: line.value,
            layer: line.layer,
          })),
        };
      }
      return {
        status: "fail",
        note: sigLines.length ? "Blank" : "Not found on the drawing",
        adjustment: "Obtain competent person and owner signatures on Form 1 / A19.",
        evidence: sigLines.slice(0, 3).map((line) => ({
          quote: line.value,
          layer: line.layer,
        })),
      };
    },
  },
  {
    id: "eng-packs",
    code: "NBR A19",
    check: "Engineering packs",
    run: (ctx) => {
      if (!/engineer/i.test(ctx.blob)) {
        return { status: "skip" };
      }
      if (/attach|outstanding|to follow|to submit/i.test(ctx.blob)) {
        return {
          status: "fail",
          note: "To attach",
          adjustment: "Attach the outstanding engineering packs to the submission.",
          evidence: quotes(ctx, /engineer/i),
        };
      }
      return {
        status: "pass",
        note: "Engineering noted",
        evidence: quotes(ctx, /engineer/i),
      };
    },
  },
];

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
        code: rule.code,
        check: rule.check,
        note: result.note,
        status: "pass",
        evidence: result.evidence,
      });
      continue;
    }
    failed.push({
      id: rule.id,
      code: rule.code,
      check: rule.check,
      note: result.note,
      status: "fail",
      adjustment: result.adjustment,
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

function findPercents(blob: string) {
  const values: number[] = [];
  for (const match of blob.matchAll(PERCENT)) {
    values.push(Number.parseFloat(match[1]));
  }
  return values;
}

function titleStreet(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function occupancyOf(extract: DrawingExtract) {
  return occupancyFromText(extract.strings.join("\n"));
}
