import { describe, expect, it } from "vitest";

import { AUTH_TRANSPORT } from "../auth-transport";
import { browserHttpClient } from "./browser";

describe("browserHttpClient", () => {
  it("uses Backend CSRF transport settings", () => {
    expect(browserHttpClient.defaults.xsrfCookieName).toBe(
      AUTH_TRANSPORT.csrf.cookieName,
    );

    expect(browserHttpClient.defaults.xsrfHeaderName).toBe(
      AUTH_TRANSPORT.csrf.headerName,
    );
  });

  it("does not enable cross-origin XSRF forwarding", () => {
    expect(browserHttpClient.defaults.withXSRFToken).toBeUndefined();
  });
});
