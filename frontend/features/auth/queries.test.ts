import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthMeRetrieveResponseMock } from "@/lib/api/generated/client/auth/auth.faker";
import { getAuthMeRetrieveMockHandler } from "@/lib/api/generated/client/auth/auth.msw";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { server } from "@/test/msw/server";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import { getCurrentUser } from "./queries";

function setSessionCookie(value = "test-session") {
  mocks.cookies.mockResolvedValue({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME
        ? {
            name: SESSION_COOKIE_NAME,
            value,
          }
        : undefined,
  });
}

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call Django when the session cookie is missing", async () => {
    let requested = false;

    mocks.cookies.mockResolvedValue({
      get: () => undefined,
    });

    server.use(
      http.get("*/api/auth/me", () => {
        requested = true;

        return new HttpResponse(null, {
          status: 500,
        });
      }),
    );

    await expect(getCurrentUser()).resolves.toBeNull();

    expect(requested).toBe(false);
  });

  it("forwards the Django session id from the session cookie", async () => {
    setSessionCookie();

    const currentUser = getAuthMeRetrieveResponseMock();

    server.use(
      getAuthMeRetrieveMockHandler(({ request }) => {
        expect(request.headers.get("cookie")).toBe("sessionid=test-session");

        return currentUser;
      }),
    );

    await expect(getCurrentUser()).resolves.toEqual(currentUser);
  });

  it("returns null for an unauthenticated Django response", async () => {
    setSessionCookie();

    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json(
          {
            detail: "Authentication is required.",
          },
          {
            status: 403,
          },
        ),
      ),
    );

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("rejects a malformed current-user response", async () => {
    setSessionCookie();

    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json({
          id: 123,
        }),
      ),
    );

    await expect(getCurrentUser()).rejects.toThrow();
  });

  it("does not hide Django failures as unauthenticated", async () => {
    setSessionCookie();

    server.use(
      http.get("*/api/auth/me", () =>
        HttpResponse.json(
          {
            detail: "Internal server error.",
          },
          {
            status: 500,
          },
        ),
      ),
    );

    await expect(getCurrentUser()).rejects.toThrow();
  });
});
