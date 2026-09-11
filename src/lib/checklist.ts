import type { AuditSample } from "@/data/types";

export const DISCLAIMER =
  "Not a stamp. Not municipal approval. Competent person and owner signatures still required.";

export function auditToReport(audit: AuditSample): string {
  const passed = audit.passed.map(
    (row) => `${row.code} — ${row.check} — ${row.note} (Pass)`,
  );

  const failed = audit.failed.flatMap((row) => [
    `${row.code} — ${row.check}`,
    row.note,
    `Adjust: ${row.adjustment}`,
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
  ]
    .filter((line) => line !== null)
    .join("\n")
    .trimEnd()
    .concat("\n");
}
