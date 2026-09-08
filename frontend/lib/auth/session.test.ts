import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

import {
  clearSession,
  getSessionId,
  SESSION_COOKIE_NAME,
  setSession,
} from "./session";

const SESSION_SECRET = "test-session-secret-at-least-32-characters";

type StoredCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

let storedCookie: StoredCookie | undefined;

describe("session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = SESSION_SECRET;
    storedCookie = undefined;

    mocks.get.mockImplementation((name: string) =>
      storedCookie?.name === name
        ? {
            name: storedCookie.name,
            value: storedCookie.value,
          }
        : undefined,
    );
    mocks.set.mockImplementation(
      (name: string, value: string, options: Record<string, unknown>) => {
        storedCookie = {
          name,
          value,
          options,
        };
      },
    );
    mocks.delete.mockImplementation((name: string) => {
      if (storedCookie?.name === name) {
        storedCookie = undefined;
      }
    });
    mocks.cookies.mockResolvedValue({
      get: mocks.get,
      set: mocks.set,
      delete: mocks.delete,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SESSION_SECRET;
  });

  it("stores the Django session id only inside an encrypted frontend cookie", async () => {
    await setSession({
      sessionId: "backend-session",
      maxAge: 1209600,
    });

    expect(storedCookie).toBeDefined();
    expect(storedCookie?.name).toBe(SESSION_COOKIE_NAME);
    expect(storedCookie?.value).not.toBe("backend-session");
    expect(storedCookie?.value).not.toContain("backend-session");
    expect(storedCookie?.options).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 1209600,
    });

    await expect(getSessionId()).resolves.toBe("backend-session");
  });

  it("rejects a raw or tampered frontend session cookie", async () => {
    storedCookie = {
      name: SESSION_COOKIE_NAME,
      value: "backend-session",
      options: {},
    };

    await expect(getSessionId()).resolves.toBeNull();
  });

  it("rejects an encrypted frontend session after its backend expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T00:00:00Z"));

    await setSession({
      sessionId: "backend-session",
      maxAge: 60,
    });

    vi.setSystemTime(new Date("2026-09-08T00:01:01Z"));

    await expect(getSessionId()).resolves.toBeNull();
  });

  it("deletes the frontend-owned session cookie", async () => {
    await setSession({
      sessionId: "backend-session",
    });
    await clearSession();

    expect(mocks.delete).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    expect(storedCookie).toBeUndefined();
  });
});
