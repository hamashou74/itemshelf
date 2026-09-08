import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("session", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.cookies.mockResolvedValue({
      get: mocks.get,
      set: mocks.set,
      delete: mocks.delete,
    });
  });

  it("reads the frontend-owned session cookie", async () => {
    mocks.get.mockReturnValue({
      value: "backend-session",
    });

    await expect(getSessionId()).resolves.toBe("backend-session");
    expect(mocks.get).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
  });

  it("sets an HttpOnly SameSite=Lax session cookie", async () => {
    await setSession({
      sessionId: "backend-session",
      maxAge: 1209600,
    });

    expect(mocks.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "backend-session",
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 1209600,
      },
    );
  });

  it("deletes the frontend-owned session cookie", async () => {
    await clearSession();

    expect(mocks.delete).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
  });
});
