import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCookie: vi.fn(),
  bootstrapCsrf: vi.fn(),
}));

vi.mock("js-cookie", () => ({
  default: {
    get: mocks.getCookie,
  },
}));

vi.mock("@/lib/api/generated/client/auth/auth", () => ({
  getAuth: () => ({
    authCsrfRetrieve: mocks.bootstrapCsrf,
  }),
}));

import { ensureCsrfCookie } from "./csrf";

describe("ensureCsrfCookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not bootstrap when the CSRF cookie already exists", async () => {
    mocks.getCookie.mockReturnValue("existing-token");

    await ensureCsrfCookie();

    expect(mocks.bootstrapCsrf).not.toHaveBeenCalled();
  });

  it("bootstraps when the CSRF cookie is missing", async () => {
    mocks.getCookie
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce("new-token");

    mocks.bootstrapCsrf.mockResolvedValue({});

    await ensureCsrfCookie();

    expect(mocks.bootstrapCsrf).toHaveBeenCalledOnce();
  });

  it("fails when Django does not set the expected cookie", async () => {
    mocks.getCookie.mockReturnValue(undefined);
    mocks.bootstrapCsrf.mockResolvedValue({});

    await expect(ensureCsrfCookie()).rejects.toThrow(
      "Backend did not set the expected CSRF cookie.",
    );
  });
});
