import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";

import { server } from "@/test/msw/server";

vi.mock("server-only", () => ({}));

import { loginBackend, logoutBackend } from "./auth";

const credentials = {
  username: "alice",
  password: "password",
};

function expectRequestCookie(
  request: Request,
  name: string,
  value: string,
): void {
  const cookies = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((cookie) => cookie.trim());

  expect(cookies).toContain(`${name}=${value}`);
}

describe("backend auth transport", () => {
  it("bootstraps CSRF and captures the Django session on login", async () => {
    server.use(
      http.get(
        "*/api/auth/csrf",
        () =>
          new HttpResponse(null, {
            status: 200,
            headers: {
              "Set-Cookie": "csrftoken=test-csrf; Path=/",
            },
          }),
      ),
      http.post("*/api/auth/login", ({ request }) => {
        expectRequestCookie(request, "csrftoken", "test-csrf");
        expect(request.headers.get("x-csrftoken")).toBe("test-csrf");
        expect(request.headers.get("origin")).toBe("http://127.0.0.1:8000");

        return new HttpResponse(null, {
          status: 200,
          headers: {
            "Set-Cookie":
              "sessionid=test-session; Max-Age=1209600; Path=/; HttpOnly",
          },
        });
      }),
    );

    await expect(loginBackend(credentials)).resolves.toEqual({
      ok: true,
      sessionId: "test-session",
      maxAge: 1209600,
    });
  });

  it("maps invalid credentials without creating a web session", async () => {
    server.use(
      http.get(
        "*/api/auth/csrf",
        () =>
          new HttpResponse(null, {
            status: 200,
            headers: {
              "Set-Cookie": "csrftoken=test-csrf; Path=/",
            },
          }),
      ),
      http.post("*/api/auth/login", () =>
        HttpResponse.json(
          {},
          {
            status: 400,
          },
        ),
      ),
    );

    await expect(loginBackend(credentials)).resolves.toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
  });

  it("bootstraps CSRF using the Django session before logout", async () => {
    server.use(
      http.get("*/api/auth/csrf", ({ request }) => {
        expectRequestCookie(request, "sessionid", "test-session");

        return new HttpResponse(null, {
          status: 200,
          headers: {
            "Set-Cookie": "csrftoken=test-csrf; Path=/",
          },
        });
      }),
      http.post("*/api/auth/logout", ({ request }) => {
        expectRequestCookie(request, "sessionid", "test-session");
        expectRequestCookie(request, "csrftoken", "test-csrf");
        expect(request.headers.get("x-csrftoken")).toBe("test-csrf");

        return new HttpResponse(null, {
          status: 200,
        });
      }),
    );

    await expect(logoutBackend("test-session")).resolves.toEqual({
      ok: true,
    });
  });
});
