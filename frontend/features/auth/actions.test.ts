import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  INITIAL_LOGIN_ACTION_STATE,
  INITIAL_LOGOUT_ACTION_STATE,
} from "@/features/auth/types";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  getSessionId: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/backend/auth", () => ({
  login: mocks.login,
  logout: mocks.logout,
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionId: mocks.getSessionId,
  setSession: mocks.setSession,
  clearSession: mocks.clearSession,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import { loginAction, logoutAction } from "./actions";

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

  it("creates the session and redirects after login", async () => {
    mocks.login.mockResolvedValue({
      ok: true,
      sessionId: "backend-session",
      maxAge: 1209600,
    });

    await loginAction(INITIAL_LOGIN_ACTION_STATE, loginFormData());

    expect(mocks.setSession).toHaveBeenCalledWith({
      sessionId: "backend-session",
      maxAge: 1209600,
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/home");
  });

  it("returns the existing invalid-credentials message", async () => {
    mocks.login.mockResolvedValue({
      ok: false,
      reason: "invalid-credentials",
    });

    await expect(
      loginAction(INITIAL_LOGIN_ACTION_STATE, loginFormData()),
    ).resolves.toEqual({
      errorMessage: "ユーザー名またはパスワードが正しくありません。",
    });
  });

  it("rejects malformed action input before calling Django", async () => {
    await expect(
      loginAction(INITIAL_LOGIN_ACTION_STATE, new FormData()),
    ).resolves.toEqual({
      errorMessage: "ユーザー名とパスワードを入力してください。",
    });
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("logs out the Django session before clearing the session cookie", async () => {
    mocks.getSessionId.mockResolvedValue("backend-session");
    mocks.logout.mockResolvedValue({
      ok: true,
    });

    await logoutAction(INITIAL_LOGOUT_ACTION_STATE);

    expect(mocks.logout).toHaveBeenCalledWith("backend-session");
    expect(mocks.clearSession).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("clears a stale session cookie when Django reports unauthenticated", async () => {
    mocks.getSessionId.mockResolvedValue("backend-session");
    mocks.logout.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });

    await logoutAction(INITIAL_LOGOUT_ACTION_STATE);

    expect(mocks.clearSession).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("preserves the session cookie when logout fails security checks", async () => {
    mocks.getSessionId.mockResolvedValue("backend-session");
    mocks.logout.mockResolvedValue({
      ok: false,
      reason: "security",
    });

    await expect(logoutAction(INITIAL_LOGOUT_ACTION_STATE)).resolves.toEqual({
      errorMessage:
        "セキュリティ検証に失敗したため、ログアウトできませんでした。もう一度お試しください。",
    });
    expect(mocks.clearSession).not.toHaveBeenCalled();
  });
});
