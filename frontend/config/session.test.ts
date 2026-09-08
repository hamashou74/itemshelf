import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getSessionSecret } from "./session";

const ORIGINAL_SESSION_SECRET = process.env.SESSION_SECRET;

afterEach(() => {
  if (ORIGINAL_SESSION_SECRET === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = ORIGINAL_SESSION_SECRET;
  }
});

describe("session config", () => {
  it("accepts a session secret with at least 32 characters", () => {
    process.env.SESSION_SECRET = "12345678901234567890123456789012";

    expect(getSessionSecret()).toBe("12345678901234567890123456789012");
  });

  it("rejects a missing or short session secret", () => {
    delete process.env.SESSION_SECRET;

    expect(() => getSessionSecret()).toThrow(
      "SESSION_SECRET must be at least 32 characters.",
    );

    process.env.SESSION_SECRET = "too-short";

    expect(() => getSessionSecret()).toThrow(
      "SESSION_SECRET must be at least 32 characters.",
    );
  });
});
