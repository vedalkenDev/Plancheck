import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISCLAIMER, ENGINE_NOTE, auditToReport } from "./checklist";
import type { AuditSample } from "@/data/types";

describe("user-facing checklist copy", () => {
  it("uses the stamp disclaimer, not a markdown download label", () => {
    assert.equal(
      DISCLAIMER,
      "Not a stamp. Not municipal approval. Competent person and owner signatures still required.",
    );
  });

  it("names the clause and whether the row was measured", () => {
    const report = auditToReport({
      id: "t",
      slug: "t",
      label: "t.pdf",
      fileStem: "t",
      project: "House",
      erf: null,
      address: "1 Test Road",
      occupancy: "H4",
      occupancyNote: "dwelling",
      verdict: "Close, not council-ready.",
      passed: [
        {
          id: "part-m",
          part: "M",
          check: "Stairs",
          detail: "170 mm riser, 250 mm going",
          status: "pass",
          clause: "SANS 10400-M",
          how: "measured",
        },
      ],
      failed: [
        {
          id: "part-r",
          part: "R",
          check: "Stormwater",
          detail: "Stormwater / soakpit missing",
          status: "fail",
          adjust: "Add Part R stormwater / soakpit information to the set.",
          clause: "SANS 10400-R",
          how: "notes",
        },
      ],
    } satisfies AuditSample);
    assert.ok(report.includes(ENGINE_NOTE));
    assert.match(report, /SANS 10400-M, measured/);
    assert.match(report, /SANS 10400-R, notes/);
  });
});
