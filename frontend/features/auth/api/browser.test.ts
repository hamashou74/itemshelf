import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import {
  getAuthCsrfRetrieveMockHandler,
  getAuthLoginCreateMockHandler,
} from "@/lib/api/generated/client/auth/auth.msw";
import { server } from "@/test/msw/server";
import { authApi } from "./browser";

const credentials = {
  username: "alice",
  password: "password",
};

function setCsrfCookie() {
  document.cookie = "csrftoken=test-csrf-token; Path=/";
}

describe("authApi", () => {
  it("logs in and sends the current CSRF token", async () => {
    setCsrfCookie();

    server.use(
      http.post("*/api/auth/login", ({ request }) => {
        expect(request.headers.get("x-csrftoken")).toBe("test-csrf-token");

        return new HttpResponse(null, {
          status: 200,
        });
      }),
    );

    await expect(authApi.login(credentials)).resolves.toEqual({
      ok: true,
    });
  });

  it("maps login 400 to invalid credentials", async () => {
    setCsrfCookie();

    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json(
          {},
          {
            status: 400,
          },
        ),
      ),
    );

    await expect(authApi.login(credentials)).resolves.toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
  });

  it("maps login 403 to a security failure", async () => {
    setCsrfCookie();

    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json(
          {
            detail: "CSRF validation failed.",
          },
          {
            status: 403,
          },
        ),
      ),
    );

    await expect(authApi.login(credentials)).resolves.toEqual({
      ok: false,
      reason: "security",
    });
  });

  it("logs out and sends the current CSRF token", async () => {
    setCsrfCookie();

    server.use(
      http.post("*/api/auth/logout", ({ request }) => {
        expect(request.headers.get("x-csrftoken")).toBe("test-csrf-token");

        return new HttpResponse(null, {
          status: 200,
        });
      }),
    );

    await expect(authApi.logout()).resolves.toEqual({
      ok: true,
    });
  });

  it("does not treat logout 403 as success", async () => {
    setCsrfCookie();

    server.use(
      http.post("*/api/auth/logout", () =>
        HttpResponse.json(
          {
            detail: "CSRF validation failed.",
          },
          {
            status: 403,
          },
        ),
      ),
    );

    await expect(authApi.logout()).resolves.toEqual({
      ok: false,
      reason: "security",
    });
  });

  it("bootstraps CSRF before login when the cookie is missing", async () => {
    let csrfBootstrapped = false;

    server.use(
      getAuthCsrfRetrieveMockHandler(() => {
        csrfBootstrapped = true;

        document.cookie = "csrftoken=bootstrapped-token; Path=/";
      }),

      getAuthLoginCreateMockHandler(({ request }) => {
        expect(csrfBootstrapped).toBe(true);

        expect(request.headers.get("x-csrftoken")).toBe("bootstrapped-token");
      }),
    );

    await expect(authApi.login(credentials)).resolves.toEqual({
      ok: true,
    });
  });
});
