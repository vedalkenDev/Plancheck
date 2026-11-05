import type { AuditSample } from "@/data/types";
import type { DrawingExtract } from "@/lib/cad/extract";
import { readFenestration } from "@/lib/sans/fenestration";
import {
  evaluateRules,
  findAddresses,
  occupancyOf,
} from "@/lib/sans/rules";
import { readSheet } from "@/lib/sans/sheet";

export function auditFromDrawing(
  filename: string,
  extract: DrawingExtract,
): AuditSample {
  const blob = extract.strings.join("\n");
  const fileStem = slugify(filename.replace(/\.(dwg|dxf|pdf)$/i, "") || "drawing");
  const occupancy = occupancyOf(extract);
  const addresses = findAddresses(blob);
  const erfMatch = blob.match(/erf\s*[:#]?\s*[\w\s,-]{2,40}/i);
  const project =
    extract.strings.find((line) => /proposed/i.test(line)) ??
    extract.strings.find((line) => line.length > 24) ??
    filename;

  const sheet = readSheet(extract);
  const ctx = {
    filename,
    extract,
    blob,
    occupancy: occupancy.code,
    occupancyNote: occupancy.note,
    addresses,
    sheet,
  };

  const { passed, failed } = evaluateRules(ctx);
  const warnings: string[] = [];
  if (extract.format === "dwg" && extract.geometry.length === 0) {
    warnings.push(
      "This DWG could not be converted. Plancheck read titles and notes only. Export DXF from CAD for a fuller preview and annotated drawing.",
    );
  }
  if (extract.format === "pdf" && extract.strings.length < 5) {
    warnings.push(
      "This PDF has little readable text. Plot from CAD as a vector PDF so titles, notes, and schedules stay selectable. Scanned sheets cannot be checked yet.",
    );
  }
  const fenestration = readFenestration(blob, sheet.windows);
  if (
    !fenestration.measured &&
    fenestration.storeys.some((row) => row.printedPercent !== undefined)
  ) {
    warnings.push(
      "XA percentages were read from the notes, not measured from window sizes. Add overall width × height on the window schedule to check the titleblock figure.",
    );
  }

  const verdict =
    failed.length === 0
      ? "Checks we could read look complete. Still a pre-submission audit, not approval."
      : failed.length <= 4
        ? "Close, not council-ready."
        : "Not council-ready.";

  return {
    id: `upload-${fileStem}`,
    slug: fileStem,
    label: filename,
    fileStem,
    project,
    erf: erfMatch ? erfMatch[0].replace(/\s+/g, " ").trim() : null,
    address: addresses[0]?.full ?? "Not found on the drawing",
    occupancy: occupancy.code,
    occupancyNote: occupancy.note,
    verdict,
    passed,
    failed,
    warnings,
    format: extract.format,
  };
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
