import type { AuditSample, FailedCheck, PassedCheck } from "@/data/types";
import type { DrawingExtract } from "@/lib/cad/extract";

const OCCUPANCY = /\b([A-H][1-5]|J[1-4])\b/;
const ADDRESS =
  /\b(\d{1,5})\s+([A-Za-z][A-Za-z]+(?:\s+[A-Za-z][A-Za-z]+){0,3}\s+(?:Road|Rd|Drive|Dr|Street|St|Avenue|Ave|Lane|Ln|Way|Crescent|Close))\b/gi;
const PERCENT = /(\d{1,2}(?:\.\d+)?)\s*%/g;
const FENESTRATION = /fenestr|glaz|window|l\/g|xa\s*4|sans 204|not required/i;

export function auditFromDrawing(
  filename: string,
  extract: DrawingExtract,
): AuditSample {
  const blob = extract.strings.join("\n");
  const fileStem = slugify(filename.replace(/\.(dwg|dxf)$/i, "") || "drawing");
  const addresses = findAddresses(blob);
  const occupancyMatch = blob.match(OCCUPANCY);
  const occupancy = occupancyMatch?.[1] ?? "—";
  const project =
    extract.strings.find((line) => /proposed/i.test(line)) ??
    extract.strings.find((line) => line.length > 24) ??
    filename;
  const erfMatch = blob.match(/erf\s*[:#]?\s*[\w\s,-]{2,40}/i);

  const passed: PassedCheck[] = [];
  const failed: FailedCheck[] = [];

  checkReadable(extract, failed);
  checkAddress(addresses, failed, passed);
  checkFenestration(blob, extract.strings, failed, passed);
  checkPartR(blob, failed, passed);
  checkPartM(blob, failed, passed);
  checkPartD(blob, failed, passed);
  checkSignatures(blob, failed, passed);
  checkTitleblocks(extract.strings, failed, passed);
  checkParking(blob, passed);
  checkCoverage(blob, passed);
  checkLighting(blob, passed);
  checkWindowSchedule(blob, passed);
  checkPartK(blob, passed);

  const verdict =
    failed.length === 0
      ? "Checks we could read look complete. Not stamp-ready by itself."
      : failed.length <= 2
        ? "Close, not stamp-ready."
        : "Not stamp-ready.";

  return {
    id: `upload-${fileStem}`,
    slug: fileStem,
    label: filename,
    fileStem,
    project,
    erf: erfMatch ? erfMatch[0].replace(/\s+/g, " ").trim() : null,
    address: addresses[0]?.full ?? "Not found on the drawing",
    occupancy,
    occupancyNote: occupancy === "—" ? "not found" : "from the drawing",
    verdict,
    passed,
    failed,
  };
}

function checkReadable(extract: DrawingExtract, failed: FailedCheck[]) {
  if (extract.strings.length >= 8) {
    return;
  }
  failed.push({
    id: "readable-text",
    check: "Drawing text",
    note:
      extract.format === "dwg"
        ? "Very little readable title or note text in this .dwg"
        : "Very little readable text in this file",
    status: "fail",
    adjustment:
      "Save a DXF from your CAD software and upload that, so Plancheck can read titles, notes, and schedules.",
  });
}

function checkAddress(
  addresses: { number: string; street: string; full: string }[],
  failed: FailedCheck[],
  passed: PassedCheck[],
) {
  if (addresses.length === 0) {
    failed.push({
      id: "address",
      check: "Address",
      note: "No street address found",
      status: "fail",
      adjustment:
        "Put one consistent address on the titleblock, application, and drawings.",
    });
    return;
  }

  const streets = new Map<string, Set<string>>();
  for (const item of addresses) {
    const key = item.street.toLowerCase();
    const set = streets.get(key) ?? new Set<string>();
    set.add(item.number);
    streets.set(key, set);
  }

  const conflict = [...streets.entries()].find(([, numbers]) => numbers.size > 1);
  if (conflict) {
    const [street, numbers] = conflict;
    failed.push({
      id: "address",
      check: "Address",
      note: `${[...numbers].join(" vs ")} ${titleStreet(street)}`,
      status: "fail",
      adjustment: `Resolve ${[...numbers].join(" vs ")} ${titleStreet(street)} across titleblock, application, and drawings so the address is consistent.`,
    });
    return;
  }

  passed.push({
    id: "address",
    check: "Address",
    note: addresses[0].full,
    status: "pass",
  });
}

function checkFenestration(
  blob: string,
  strings: string[],
  failed: FailedCheck[],
  passed: PassedCheck[],
) {
  const related = strings.filter((line) => FENESTRATION.test(line));
  const percents = findPercents(related.join("\n") || blob);
  const over = percents.filter((value) => value > 15);
  const mentionsXa = /xa/i.test(blob);
  const mentions204 = /sans\s*204/i.test(blob);
  const saysNotRequired = /not required/i.test(blob);

  if (over.length && (saysNotRequired || !mentions204)) {
    failed.push({
      id: "xa-fenestration",
      check: "XA fenestration",
      note: `Glazing at ${over.map((value) => `${value}%`).join(" and ")} exceed 15%. SANS 204 required.`,
      status: "fail",
      adjustment:
        "Recalculate fenestration. Where the glazed area is over 15%, do not leave XA as “not required”; SANS 204 is required.",
    });
    return;
  }

  if ((mentionsXa || /fenestr/i.test(blob)) && percents.length === 0) {
    failed.push({
      id: "xa-444",
      check: "XA 4.4.4 fenestration",
      note: "Fenestration % missing",
      status: "fail",
      adjustment:
        "Complete XA 4.4.4 with fenestration percentages. The field is missing.",
    });
    return;
  }

  if (!mentionsXa && !/fenestr|glaz/i.test(blob)) {
    failed.push({
      id: "xa-missing",
      check: "XA fenestration",
      note: "Not found on the drawing",
      status: "fail",
      adjustment:
        "Add fenestration percentages to the XA sheet. If they exceed 15%, mark SANS 204 as required.",
    });
    return;
  }

  passed.push({
    id: "xa-fenestration",
    check: "XA fenestration",
    note: percents.length
      ? percents.map((value) => `${value}%`).join(", ")
      : "Noted on the drawing",
    status: "pass",
  });
}

function checkPartR(
  blob: string,
  failed: FailedCheck[],
  passed: PassedCheck[],
) {
  if (/soak\s*pit|stormwater|storm water/i.test(blob)) {
    passed.push({
      id: "part-r",
      check: "Part R stormwater",
      note: "Soakpit / stormwater noted",
      status: "pass",
    });
    return;
  }
  failed.push({
    id: "part-r",
    check: "Part R stormwater",
    note: "Stormwater / soakpit missing",
    status: "fail",
    adjustment: "Add Part R stormwater / soakpit information to the set.",
  });
}

function checkPartM(
  blob: string,
  failed: FailedCheck[],
  passed: PassedCheck[],
) {
  const hasStair = /stair/i.test(blob);
  const hasDims = /\b\d+(\.\d+)?\s*(mm|m)\b/i.test(blob) && hasStair;
  if (hasStair && hasDims) {
    passed.push({
      id: "part-m",
      check: "Stairs",
      note: "Part M dimensions noted",
      status: "pass",
    });
    return;
  }
  failed.push({
    id: "part-m",
    check: "Part M stairs",
    note: hasStair ? "Stair dims missing" : "Stair dimensions not found",
    status: "fail",
    adjustment: "Dimension stairs to Part M on the drawings.",
  });
}

function checkPartD(
  blob: string,
  failed: FailedCheck[],
  passed: PassedCheck[],
) {
  if (!/pool|swimming/i.test(blob)) {
    return;
  }
  if (/enclos/i.test(blob)) {
    passed.push({
      id: "part-d",
      check: "Pool enclosure",
      note: "Part D enclosure noted",
      status: "pass",
    });
    return;
  }
  failed.push({
    id: "part-d",
    check: "Pool enclosure",
    note: "Part D enclosure missing",
    status: "fail",
    adjustment: "Add Part D swimming pool enclosure details to the drawing set.",
  });
}

function checkSignatures(
  blob: string,
  failed: FailedCheck[],
  passed: PassedCheck[],
) {
  const mentions = /signatur|signed|competent person|owner/i.test(blob);
  const named = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(blob) && /sign/i.test(blob);
  if (named && !/blank|unsigned/i.test(blob)) {
    passed.push({
      id: "signatures",
      check: "Signatures",
      note: "Name found near signature fields",
      status: "pass",
    });
    return;
  }
  failed.push({
    id: "signatures",
    check: "Signatures",
    note: mentions ? "Blank" : "Not found on the drawing",
    status: "fail",
    adjustment: "Obtain competent person and owner signatures.",
  });
}

function checkTitleblocks(
  strings: string[],
  failed: FailedCheck[],
  passed: PassedCheck[],
) {
  const titles = strings.filter((line) => /proposed|titleblock|title block/i.test(line));
  const unique = [...new Set(titles.map((line) => line.toLowerCase()))];
  if (unique.length > 1) {
    failed.push({
      id: "titleblocks",
      check: "Titleblocks",
      note: "More than one project title on the set",
      status: "fail",
      adjustment:
        "Replace leftover titleblocks so every sheet matches this project.",
    });
    return;
  }
  if (titles.length) {
    passed.push({
      id: "titleblocks",
      check: "Titleblocks",
      note: "One project title found",
      status: "pass",
    });
  }
}

function checkParking(blob: string, passed: PassedCheck[]) {
  const match = blob.match(/parking[^\n]{0,40}/i);
  if (!match) {
    return;
  }
  if (/\d+\s*\/\s*\d+|\d+\s*(bays|provided)/i.test(match[0]) || /\d+/.test(match[0])) {
    passed.push({
      id: "parking",
      check: "Parking",
      note: match[0].replace(/\s+/g, " ").trim(),
      status: "pass",
    });
  }
}

function checkCoverage(blob: string, passed: PassedCheck[]) {
  const match = blob.match(/coverage[^\n]{0,32}/i);
  if (!match) {
    return;
  }
  passed.push({
    id: "coverage",
    check: "Coverage",
    note: match[0].replace(/\s+/g, " ").trim(),
    status: "pass",
  });
}

function checkLighting(blob: string, passed: PassedCheck[]) {
  if (/w\s*\/\s*m/i.test(blob) || /lighting/i.test(blob)) {
    passed.push({
      id: "lighting",
      check: "Lighting",
      note: /w\s*\/\s*m/i.test(blob) ? "W/m² noted" : "Lighting noted",
      status: "pass",
    });
  }
}

function checkWindowSchedule(blob: string, passed: PassedCheck[]) {
  if (/window schedule/i.test(blob)) {
    passed.push({
      id: "window-schedule",
      check: "Window schedule",
      note: "Present",
      status: "pass",
    });
  }
}

function checkPartK(blob: string, passed: PassedCheck[]) {
  if (/part\s*k|boundary wall/i.test(blob)) {
    passed.push({
      id: "part-k",
      check: "Part K",
      note: "Boundary wall noted",
      status: "pass",
    });
  }
}

function findAddresses(blob: string) {
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

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "drawing"
  );
}

function titleStreet(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
