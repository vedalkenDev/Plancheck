import type { AuditSample } from "@/data/types";

export const DISCLAIMER =
  "Not a stamp. Not municipal approval. Competent person and owner signatures still required.";

export function auditToMarkdown(audit: AuditSample): string {
  const meta = [
    `# Plancheck — ${audit.project}`,
    "",
    `- Address: ${audit.address}`,
    audit.erf ? `- Erf: ${audit.erf}` : null,
    `- Occupancy: ${audit.occupancy} (${audit.occupancyNote})`,
    `- Verdict: ${audit.verdict}`,
    "",
    DISCLAIMER,
    "",
    "## PASSED",
    "",
    "| Check | Numbers / note | Status |",
    "| --- | --- | --- |",
    ...audit.passed.map((row) => `| ${row.check} | ${row.note} | Pass |`),
    "",
    "## FAILED",
    "",
    ...audit.failed.flatMap((row) => [
      `### ${row.check}`,
      "",
      row.note,
      "",
      `Adjust: ${row.adjustment}`,
      "",
    ]),
  ];

  return meta.filter((line) => line !== null).join("\n");
}

export function annotatedDrawingPlaceholder(audit: AuditSample): string {
  const failed = audit.failed
    .map((row) => `- ${row.check}: ${row.adjustment}`)
    .join("\n");

  return [
    "Plancheck annotated drawing (MVP placeholder)",
    DISCLAIMER,
    "",
    audit.project,
    audit.address,
    audit.erf ? `Erf: ${audit.erf}` : null,
    `Occupancy: ${audit.occupancy} (${audit.occupancyNote})`,
    `Verdict: ${audit.verdict}`,
    "",
    "FAILED",
    failed,
    "",
    "Live CAD annotation ships when Knight wires the audit engine.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
