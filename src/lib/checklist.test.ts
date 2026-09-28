import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditSample } from "@/data/types";
import { auditToReport, DISCLAIMER } from "./checklist";

describe("user-facing checklist copy", () => {
  it("uses the stamp disclaimer, not a markdown download label", () => {
    assert.equal(
      DISCLAIMER,
      "Not a stamp. Not municipal approval. Competent person and owner signatures still required.",
    );
  });

  it("writes the clause on each pass and each fail", () => {
    const audit: AuditSample = {
      id: "sheet",
      slug: "sheet",
      label: "Sheet",
      fileStem: "sheet",
      project: "Sheet",
      erf: null,
      address: "69 Marine Drive",
      occupancy: "H4",
      occupancyNote: "dwelling",
      verdict: "Close, not council-ready.",
      passed: [
        {
          id: "part-m",
          part: "M",
          check: "Stairs",
          detail: "Part M dimensions noted",
          status: "pass",
          clause: {
            book: "M",
            ref: "4.2",
            label: "Dimensional requirements",
            page: 6,
          },
        },
      ],
      failed: [
        {
          id: "xa-fenestration",
          part: "XA",
          check: "XA fenestration",
          detail: "Ground 16.9% exceed 15%. SANS 204 required.",
          status: "fail",
          adjust: "Apply SANS 204.",
          clause: {
            book: "XA",
            ref: "4.4",
            label: "Building envelope requirements",
            page: 9,
          },
        },
        {
          id: "coverage",
          part: "Zoning",
          check: "Coverage",
          detail: "Coverage blank",
          status: "fail",
          adjust: "Fill in the coverage figure.",
        },
      ],
    };
    const report = auditToReport(audit);
    assert.match(report, /SANS 10400-M 4\.2 Dimensional requirements, page 6/);
    assert.match(report, /SANS 10400-XA 4\.4 Building envelope requirements, page 9/);
    assert.match(report, /No SANS 10400 clause for this check\./);
  });
});
