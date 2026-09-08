import { parseCookie } from "cookie";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createHttpClient } from "./http";

function getClientCookies(client: ReturnType<typeof createHttpClient>) {
  const cookieHeader = client.defaults.headers.Cookie;

  expect(typeof cookieHeader).toBe("string");

  return parseCookie(String(cookieHeader));
}

describe("createHttpClient", () => {
  it("sets the Django session cookie for authenticated requests", () => {
    const client = createHttpClient({
      sessionId: "test-session",
    });

    expect(getClientCookies(client)).toMatchObject({
      sessionid: "test-session",
    });
  });

  it("sets the Django CSRF cookie, header, and same-origin Origin", () => {
    const client = createHttpClient({
      sessionId: "test-session",
      csrfToken: "test-csrf",
    });

    expect(getClientCookies(client)).toMatchObject({
      sessionid: "test-session",
      csrftoken: "test-csrf",
    });
    expect(client.defaults.headers["X-CSRFToken"]).toBe("test-csrf");
    expect(client.defaults.headers.Origin).toBe("http://127.0.0.1:8000");
  });

  it("locks requests to the configured backend without redirects", () => {
    const client = createHttpClient();

    expect(client.defaults.baseURL).toBe("http://127.0.0.1:8000");
    expect(client.defaults.allowAbsoluteUrls).toBe(false);
    expect(client.defaults.maxRedirects).toBe(0);
  });
});
