import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISCLAIMER } from "./checklist";

describe("user-facing checklist copy", () => {
  it("uses the stamp disclaimer, not a markdown download label", () => {
    assert.equal(
      DISCLAIMER,
      "Not a stamp. Not municipal approval. Competent person and owner signatures still required.",
    );
  });
});
