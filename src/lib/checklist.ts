import type { AuditSample, SansClause } from "@/data/types";
import { formatClause } from "@/lib/sans/clauses";

export const DISCLAIMER =
  "Not a stamp. Not municipal approval. Competent person and owner signatures still required.";

export function auditToReport(audit: AuditSample): string {
  const passed = audit.passed.flatMap((row) => [
    clauseLine(row.clause),
    `${row.part} — ${row.check} — ${row.detail} (Pass)`,
  ]);

  const failed = audit.failed.flatMap((row) => [
    clauseLine(row.clause),
    `${row.part} — ${row.check}`,
    row.detail,
    `Adjust: ${row.adjust}`,
    "",
  ]);

  return [
    "Plancheck",
    audit.project,
    "",
    `Address: ${audit.address}`,
    audit.erf ? `Erf: ${audit.erf}` : null,
    `Occupancy: ${audit.occupancy} · ${audit.occupancyNote}`,
    `Verdict: ${audit.verdict}`,
    "",
    DISCLAIMER,
    "",
    "PASSED",
    ...passed,
    "",
    "FAILED",
    ...failed,
    "Finding first. Fixing is the job.",
    "Luqmaan Sayed",
  ]
    .filter((line) => line !== null)
    .join("\n")
    .trimEnd()
    .concat("\n");
}

function clauseLine(clause: SansClause | undefined) {
  return clause ? formatClause(clause) : "No SANS 10400 clause for this check.";
}

export function downloadBlob(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
