import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}));

vi.mock("@/lib/api/csrf", () => ({
  withCsrf: async <T>(request: () => Promise<T>) => request(),
}));

vi.mock("@/lib/api/generated/client/auth/auth", () => ({
  getAuth: () => ({
    authLoginCreate: mocks.login,
    authLogoutCreate: mocks.logout,
    authMeRetrieve: mocks.me,
  }),
}));

import { authApi } from "./browser";

function axiosError(status: number) {
  return {
    isAxiosError: true,
    response: {
      status,
    },
  };
}

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.login.mockResolvedValue({});
    mocks.logout.mockResolvedValue({});
    mocks.me.mockResolvedValue({});
  });

  it("returns success after login", async () => {
    await expect(
      authApi.login({
        username: "alice",
        password: "password",
      }),
    ).resolves.toEqual({
      ok: true,
    });
  });

  it("maps login 400 to invalid credentials", async () => {
    mocks.login.mockRejectedValue(axiosError(400));

    await expect(
      authApi.login({
        username: "alice",
        password: "wrong",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
  });

  it("maps login 403 to a security failure", async () => {
    mocks.login.mockRejectedValue(axiosError(403));

    await expect(
      authApi.login({
        username: "alice",
        password: "password",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "security",
    });
  });

  it("returns signed-out after successful logout", async () => {
    await expect(authApi.logout()).resolves.toEqual({
      state: "signed-out",
    });
  });

  it("treats logout 403 with no active session as signed out", async () => {
    mocks.logout.mockRejectedValue(axiosError(403));

    mocks.me.mockRejectedValue(axiosError(403));

    await expect(authApi.logout()).resolves.toEqual({
      state: "signed-out",
    });
  });

  it("keeps the user signed in when logout fails security validation", async () => {
    mocks.logout.mockRejectedValue(axiosError(403));

    mocks.me.mockResolvedValue({
      data: {
        id: "949c597a-2520-4e00-bcd7-e808f87abc91",
      },
    });

    await expect(authApi.logout()).resolves.toEqual({
      state: "still-authenticated",
      reason: "security",
    });
  });
});
