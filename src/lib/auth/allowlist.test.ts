import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { allowedEmails, isAllowedEmail } from "./allowlist";
import { readGate, sealGate } from "./gate";
import { isPublicPath, publicOrigin, safeNextPath } from "./paths";
import { parseEmail, parseWaitlistFields } from "./waitlist";

const originalAllowed = process.env.PLANCHECK_ALLOWED_EMAIL;
const originalAllowedList = process.env.PLANCHECK_ALLOWED_EMAILS;
const originalGateSecret = process.env.PLANCHECK_GATE_SECRET;
const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  restore("PLANCHECK_ALLOWED_EMAIL", originalAllowed);
  restore("PLANCHECK_ALLOWED_EMAILS", originalAllowedList);
  restore("PLANCHECK_GATE_SECRET", originalGateSecret);
  restore("SUPABASE_SERVICE_ROLE_KEY", originalServiceRole);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("isAllowedEmail", () => {
  it("always allows the two private addresses, even with an empty env list", () => {
    delete process.env.PLANCHECK_ALLOWED_EMAIL;
    delete process.env.PLANCHECK_ALLOWED_EMAILS;
    assert.deepEqual(allowedEmails(), [
      "vedalken.dev@gmail.com",
      "uwaism0502@gmail.com",
    ]);
    assert.equal(isAllowedEmail("Vedalken.dev@gmail.com"), true);
    assert.equal(isAllowedEmail("uwaism0502@gmail.com"), true);
    assert.equal(isAllowedEmail("other@gmail.com"), false);
    assert.equal(isAllowedEmail(null), false);
  });

  it("also accepts extra env addresses, ignoring case", () => {
    process.env.PLANCHECK_ALLOWED_EMAILS = " extra@vedalken.dev ";
    assert.equal(isAllowedEmail("extra@vedalken.dev"), true);
    assert.equal(isAllowedEmail("vedalken.dev@gmail.com"), true);
    assert.equal(isAllowedEmail("other@gmail.com"), false);
  });
});

describe("gate cookie", () => {
  it("round-trips an allowed email and rejects a forged or expired token", () => {
    process.env.PLANCHECK_GATE_SECRET = "test-secret";
    const now = 1_700_000_000_000;
    const token = sealGate("Vedalken.dev@gmail.com", now);
    assert.equal(readGate(token, now + 1000), "vedalken.dev@gmail.com");
    assert.equal(readGate(`${token}x`, now + 1000), null);
    assert.equal(readGate(token, now + 60 * 60 * 24 * 31 * 1000), null);
  });

  it("rejects a token for an address that is not allowed", () => {
    process.env.PLANCHECK_GATE_SECRET = "test-secret";
    const token = sealGate("other@gmail.com");
    assert.equal(readGate(token), null);
  });
});

describe("parseWaitlistFields", () => {
  it("keeps a trimmed name, email, and position", () => {
    const parsed = parseWaitlistFields({
      email: "  Name@Office.test ",
      name: "  Luqmaan Sayed  ",
      position: " Principal ",
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(parsed.value, {
        email: "name@office.test",
        name: "Luqmaan Sayed",
        position: "Principal",
      });
    }
  });

  it("rejects a blank name, position, or email", () => {
    assert.equal(parseEmail("not-an-email").ok, false);
    assert.equal(
      parseWaitlistFields({
        email: "ok@office.test",
        name: "A",
        position: "Principal",
      }).ok,
      false,
    );
    assert.equal(
      parseWaitlistFields({
        email: "ok@office.test",
        name: "Luqmaan",
        position: "",
      }).ok,
      false,
    );
  });
});

describe("auth paths", () => {
  it("keeps login, waitlist, logout, and wasm public", () => {
    assert.equal(isPublicPath("/login"), true);
    assert.equal(isPublicPath("/waitlist"), true);
    assert.equal(isPublicPath("/auth/logout"), true);
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
      new Request("http://localhost:43173/auth/logout", {
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
      new Request("http://127.0.0.1:43173/auth/logout", {
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
