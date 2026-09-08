import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getApiTimeoutMs, getBackendApiOrigin } from "./backend";

const ORIGINAL_BACKEND_API_ORIGIN = process.env.BACKEND_API_ORIGIN;
const ORIGINAL_API_TIMEOUT_MS = process.env.API_TIMEOUT_MS;

describe("backend config", () => {
  beforeEach(() => {
    process.env.BACKEND_API_ORIGIN = "http://127.0.0.1:8000";
    process.env.API_TIMEOUT_MS = "10000";
  });

  afterEach(() => {
    if (ORIGINAL_BACKEND_API_ORIGIN === undefined) {
      delete process.env.BACKEND_API_ORIGIN;
    } else {
      process.env.BACKEND_API_ORIGIN = ORIGINAL_BACKEND_API_ORIGIN;
    }

    if (ORIGINAL_API_TIMEOUT_MS === undefined) {
      delete process.env.API_TIMEOUT_MS;
    } else {
      process.env.API_TIMEOUT_MS = ORIGINAL_API_TIMEOUT_MS;
    }
  });

  it("normalizes an HTTP(S) backend origin", () => {
    process.env.BACKEND_API_ORIGIN = " HTTPS://EXAMPLE.COM:443 ";

    expect(getBackendApiOrigin()).toBe("https://example.com");
  });

  it("rejects backend URLs that contain a path, query, or hash", () => {
    process.env.BACKEND_API_ORIGIN = "https://example.com/api";

    expect(() => getBackendApiOrigin()).toThrow(
      "BACKEND_API_ORIGIN must contain only an origin",
    );
  });

  it("rejects non-HTTP backend URLs", () => {
    process.env.BACKEND_API_ORIGIN = "ftp://example.com";

    expect(() => getBackendApiOrigin()).toThrow(
      "BACKEND_API_ORIGIN must use the http or https protocol.",
    );
  });

  it("parses a positive integer API timeout", () => {
    process.env.API_TIMEOUT_MS = "2500";

    expect(getApiTimeoutMs()).toBe(2500);
  });

  it.each(["0", "-1", "1.5", "not-a-number"])(
    "rejects an invalid API timeout: %s",
    (value) => {
      process.env.API_TIMEOUT_MS = value;

      expect(() => getApiTimeoutMs()).toThrow(
        "API_TIMEOUT_MS must be a positive integer.",
      );
    },
  );

  it("requires both backend environment variables", () => {
    delete process.env.BACKEND_API_ORIGIN;
    delete process.env.API_TIMEOUT_MS;

    expect(() => getBackendApiOrigin()).toThrow(
      "BACKEND_API_ORIGIN is required.",
    );
    expect(() => getApiTimeoutMs()).toThrow("API_TIMEOUT_MS is required.");
  });
});
