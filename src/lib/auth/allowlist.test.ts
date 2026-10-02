import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { allowedEmails, isAllowedEmail } from "./allowlist";
import { isPublicPath, publicOrigin, safeNextPath } from "./paths";
import { parseWaitlistFields } from "./waitlist";

const originalAllowed = process.env.PLANCHECK_ALLOWED_EMAIL;
const originalAllowedList = process.env.PLANCHECK_ALLOWED_EMAILS;

afterEach(() => {
  if (originalAllowed === undefined) {
    delete process.env.PLANCHECK_ALLOWED_EMAIL;
  } else {
    process.env.PLANCHECK_ALLOWED_EMAIL = originalAllowed;
  }
  if (originalAllowedList === undefined) {
    delete process.env.PLANCHECK_ALLOWED_EMAILS;
  } else {
    process.env.PLANCHECK_ALLOWED_EMAILS = originalAllowedList;
  }
});

describe("isAllowedEmail", () => {
  it("denies everyone when the allowlist is empty", () => {
    delete process.env.PLANCHECK_ALLOWED_EMAIL;
    delete process.env.PLANCHECK_ALLOWED_EMAILS;
    assert.deepEqual(allowedEmails(), []);
    assert.equal(isAllowedEmail("vedalken.dev@gmail.com"), false);
  });

  it("accepts the two configured Google accounts, ignoring case", () => {
    delete process.env.PLANCHECK_ALLOWED_EMAIL;
    process.env.PLANCHECK_ALLOWED_EMAILS =
      " vedalken.dev@gmail.com, uwaism0502@gmail.com ";
    assert.equal(isAllowedEmail("Vedalken.dev@gmail.com"), true);
    assert.equal(isAllowedEmail("uwaism0502@gmail.com"), true);
    assert.equal(isAllowedEmail("other@gmail.com"), false);
    assert.equal(isAllowedEmail(null), false);
  });
});

describe("parseWaitlistFields", () => {
  it("keeps a trimmed name and position", () => {
    const parsed = parseWaitlistFields({
      name: "  Luqmaan Sayed  ",
      position: " Principal ",
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(parsed.value, {
        name: "Luqmaan Sayed",
        position: "Principal",
      });
    }
  });

  it("rejects a blank name or position", () => {
    assert.equal(parseWaitlistFields({ name: "A", position: "Principal" }).ok, false);
    assert.equal(parseWaitlistFields({ name: "Luqmaan", position: "" }).ok, false);
  });
});

describe("auth paths", () => {
  it("keeps login, waitlist, OAuth, and wasm public", () => {
    assert.equal(isPublicPath("/login"), true);
    assert.equal(isPublicPath("/waitlist"), true);
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

  it("uses the Host header in development", () => {
    const origin = publicOrigin(
      new Request("http://localhost:43173/auth/google", {
        headers: {
          host: "127.0.0.1:43173",
          "x-forwarded-host": "evil.test",
        },
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
