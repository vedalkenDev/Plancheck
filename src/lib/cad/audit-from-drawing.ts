import type { AuditSample } from "@/data/types";
import type { DrawingExtract } from "@/lib/cad/extract";
import {
  evaluateRules,
  findAddresses,
  occupancyOf,
} from "@/lib/sans/rules";

export function auditFromDrawing(
  filename: string,
  extract: DrawingExtract,
): AuditSample {
  const blob = extract.strings.join("\n");
  const fileStem = slugify(filename.replace(/\.(dwg|dxf)$/i, "") || "drawing");
  const occupancy = occupancyOf(extract);
  const addresses = findAddresses(blob);
  const erfMatch = blob.match(/erf\s*[:#]?\s*[\w\s,-]{2,40}/i);
  const project =
    extract.strings.find((line) => /proposed/i.test(line)) ??
    extract.strings.find((line) => line.length > 24) ??
    filename;

  const ctx = {
    filename,
    extract,
    blob,
    occupancy: occupancy.code,
    occupancyNote: occupancy.note,
    addresses,
  };

  const { passed, failed } = evaluateRules(ctx);
  const warnings: string[] = [];
  if (extract.format === "dwg" && extract.geometry.length === 0) {
    warnings.push(
      "Binary DWG — Plancheck reads title and note strings, not geometry. Save a DXF for a drawing preview.",
    );
  }

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
