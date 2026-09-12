import type { AuditSample } from "@/data/types";

export const DISCLAIMER =
  "Pre-submission audit. Not municipal approval. Not a competent-person substitute. Signatures still required.";

export function auditToReport(audit: AuditSample): string {
  const passed = audit.passed.map(
    (row) => `${row.part} — ${row.check} — ${row.detail} (Pass)`,
  );

  const failed = audit.failed.flatMap((row) => [
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

export function downloadBlob(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
