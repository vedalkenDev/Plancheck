import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { allowedEmail, isAllowedEmail } from "./allowlist";
import { isPublicPath, publicOrigin, safeNextPath } from "./paths";

const originalAllowed = process.env.PLANCHECK_ALLOWED_EMAIL;

afterEach(() => {
  if (originalAllowed === undefined) {
    delete process.env.PLANCHECK_ALLOWED_EMAIL;
  } else {
    process.env.PLANCHECK_ALLOWED_EMAIL = originalAllowed;
  }
});

describe("isAllowedEmail", () => {
  it("denies everyone when the allowlist is empty", () => {
    delete process.env.PLANCHECK_ALLOWED_EMAIL;
    assert.equal(allowedEmail(), "");
    assert.equal(isAllowedEmail("vedalken.dev@gmail.com"), false);
  });

  it("accepts only the configured Google account, ignoring case", () => {
    process.env.PLANCHECK_ALLOWED_EMAIL = " vedalken.dev@gmail.com ";
    assert.equal(isAllowedEmail("Vedalken.dev@gmail.com"), true);
    assert.equal(isAllowedEmail("other@gmail.com"), false);
    assert.equal(isAllowedEmail(null), false);
    assert.equal(isAllowedEmail(""), false);
  });
});

describe("auth paths", () => {
  it("keeps login, OAuth, and wasm public", () => {
    assert.equal(isPublicPath("/login"), true);
    assert.equal(isPublicPath("/auth/callback"), true);
    assert.equal(isPublicPath("/wasm/libredwg/libredwg-web.js"), true);
    assert.equal(isPublicPath("/plancheck"), false);
    assert.equal(isPublicPath("/api/sans/pdf"), false);
  });

  it("rejects open redirects in next=", () => {
    assert.equal(safeNextPath("/plancheck"), "/plancheck");
    assert.equal(safeNextPath("//evil.test"), "/plancheck");
    assert.equal(safeNextPath("https://evil.test"), "/plancheck");
    assert.equal(safeNextPath("plancheck"), "/plancheck");
  });

  it("uses the request origin in development", () => {
    const origin = publicOrigin(
      new Request("http://127.0.0.1:43173/auth/google", {
        headers: { "x-forwarded-host": "evil.test" },
      }),
      "development",
    );
    assert.equal(origin, "http://127.0.0.1:43173");
  });

  it("uses the forwarded host outside development", () => {
    const origin = publicOrigin(
      new Request("http://127.0.0.1:43173/auth/callback", {
        headers: {
          "x-forwarded-host": "vedalken.dev",
          "x-forwarded-proto": "https",
        },
      }),
      "production",
    );
    assert.equal(origin, "https://vedalken.dev");
  });
});
