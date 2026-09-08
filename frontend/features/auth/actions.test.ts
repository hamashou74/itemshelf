import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  INITIAL_LOGIN_ACTION_STATE,
  INITIAL_LOGOUT_ACTION_STATE,
} from "@/features/auth/types";

const mocks = vi.hoisted(() => ({
  loginBackend: vi.fn(),
  logoutBackend: vi.fn(),
  getWebSessionId: vi.fn(),
  setWebSession: vi.fn(),
  clearWebSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/backend/auth", () => ({
  loginBackend: mocks.loginBackend,
  logoutBackend: mocks.logoutBackend,
}));

vi.mock("@/lib/auth/session", () => ({
  getWebSessionId: mocks.getWebSessionId,
  setWebSession: mocks.setWebSession,
  clearWebSession: mocks.clearWebSession,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import { login, logout } from "./actions";

function loginFormData() {
  const formData = new FormData();
  formData.set("username", "alice");
  formData.set("password", "password");

  return formData;
}

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the web session and redirects after backend login", async () => {
    mocks.loginBackend.mockResolvedValue({
      ok: true,
      sessionId: "backend-session",
      maxAge: 1209600,
    });

    await login(INITIAL_LOGIN_ACTION_STATE, loginFormData());

    expect(mocks.setWebSession).toHaveBeenCalledWith({
      sessionId: "backend-session",
      maxAge: 1209600,
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/home");
  });

  it("returns the existing invalid-credentials message", async () => {
    mocks.loginBackend.mockResolvedValue({
      ok: false,
      reason: "invalid-credentials",
    });

    await expect(
      login(INITIAL_LOGIN_ACTION_STATE, loginFormData()),
    ).resolves.toEqual({
      errorMessage: "ユーザー名またはパスワードが正しくありません。",
    });
  });

  it("rejects malformed action input before calling Django", async () => {
    await expect(
      login(INITIAL_LOGIN_ACTION_STATE, new FormData()),
    ).resolves.toEqual({
      errorMessage: "ユーザー名とパスワードを入力してください。",
    });
    expect(mocks.loginBackend).not.toHaveBeenCalled();
  });

  it("logs out the Django session before clearing the web session", async () => {
    mocks.getWebSessionId.mockResolvedValue("backend-session");
    mocks.logoutBackend.mockResolvedValue({
      ok: true,
    });

    await logout(INITIAL_LOGOUT_ACTION_STATE);

    expect(mocks.logoutBackend).toHaveBeenCalledWith("backend-session");
    expect(mocks.clearWebSession).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("clears a stale web session when Django reports unauthenticated", async () => {
    mocks.getWebSessionId.mockResolvedValue("backend-session");
    mocks.logoutBackend.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });

    await logout(INITIAL_LOGOUT_ACTION_STATE);

    expect(mocks.clearWebSession).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("preserves the web session when backend logout fails security checks", async () => {
    mocks.getWebSessionId.mockResolvedValue("backend-session");
    mocks.logoutBackend.mockResolvedValue({
      ok: false,
      reason: "security",
    });

    await expect(logout(INITIAL_LOGOUT_ACTION_STATE)).resolves.toEqual({
      errorMessage:
        "セキュリティ検証に失敗したため、ログアウトできませんでした。もう一度お試しください。",
    });
    expect(mocks.clearWebSession).not.toHaveBeenCalled();
  });
});
