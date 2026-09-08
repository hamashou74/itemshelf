import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createHttpClient } from "./http";

describe("createHttpClient", () => {
  it("sets the Django session cookie for authenticated requests", () => {
    const client = createHttpClient({
      sessionId: "test-session",
    });

    expect(client.defaults.headers.Cookie).toBe("sessionid=test-session");
  });

  it("sets the Django CSRF cookie, header, and same-origin Origin", () => {
    const client = createHttpClient({
      sessionId: "test-session",
      csrfToken: "test-csrf",
    });

    expect(client.defaults.headers.Cookie).toBe(
      "sessionid=test-session; csrftoken=test-csrf",
    );
    expect(client.defaults.headers["X-CSRFToken"]).toBe("test-csrf");
    expect(client.defaults.headers.Origin).toBe("http://127.0.0.1:8000");
  });
});
