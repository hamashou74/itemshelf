import { describe, expect, it } from "vitest";

import { getAuthCsrfRetrieveMockHandler } from "@/lib/api/generated/client/auth/auth.msw";
import { server } from "@/test/msw/server";

import { ensureCsrfCookie } from "./csrf";

describe("ensureCsrfCookie", () => {
  it("does not bootstrap when the CSRF cookie already exists", async () => {
    let requested = false;

    document.cookie = "csrftoken=existing-token; Path=/";

    server.use(
      getAuthCsrfRetrieveMockHandler(() => {
        requested = true;
      }),
    );

    await ensureCsrfCookie();

    expect(requested).toBe(false);
  });

  it("bootstraps when the CSRF cookie is missing", async () => {
    server.use(
      getAuthCsrfRetrieveMockHandler(() => {
        document.cookie = "csrftoken=bootstrapped-token; Path=/";
      }),
    );

    await ensureCsrfCookie();

    expect(document.cookie).toContain("csrftoken=bootstrapped-token");
  });

  it("fails when the backend does not set the expected cookie", async () => {
    await expect(ensureCsrfCookie()).rejects.toThrow(
      "Backend did not set the expected CSRF cookie.",
    );
  });
});
