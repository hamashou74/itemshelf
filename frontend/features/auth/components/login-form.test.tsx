import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "@/features/auth/api/browser";
import { LoginForm } from "./login-form";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@/features/auth/api/browser", () => ({
  authApi: {
    login: vi.fn(),
  },
}));

const loginMock = vi.mocked(authApi.login);

function fillAndSubmitLoginForm() {
  const usernameInput = screen.getByLabelText("ユーザー名") as HTMLInputElement;
  const passwordInput = screen.getByLabelText("パスワード") as HTMLInputElement;
  const submitButton = screen.getByRole("button", {
    name: "ログイン",
  }) as HTMLButtonElement;

  fireEvent.change(usernameInput, {
    target: {
      value: "alice",
    },
  });
  fireEvent.change(passwordInput, {
    target: {
      value: "password",
    },
  });
  fireEvent.click(submitButton);

  return submitButton;
}

describe("LoginForm", () => {
  beforeEach(() => {
    loginMock.mockReset();
    replaceMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("logs in with the submitted credentials and navigates home", async () => {
    loginMock.mockResolvedValue({
      ok: true,
    });

    render(<LoginForm />);

    fillAndSubmitLoginForm();

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        username: "alice",
        password: "password",
      });
      expect(replaceMock).toHaveBeenCalledWith("/home");
    });
  });

  it.each([
    ["invalid-credentials", "ユーザー名またはパスワードが正しくありません。"],
    ["security", "セキュリティ検証に失敗しました。もう一度お試しください。"],
    ["unexpected", "ログインに失敗しました。もう一度お試しください。"],
  ] as const)("shows the mapped %s error", async (reason, expectedMessage) => {
    loginMock.mockResolvedValue({
      ok: false,
      reason,
    });

    render(<LoginForm />);

    fillAndSubmitLoginForm();

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toBe(expectedMessage);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("uses the action pending state while login is in progress", async () => {
    let resolveLogin!: (
      result: Awaited<ReturnType<typeof authApi.login>>,
    ) => void;

    loginMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    render(<LoginForm />);

    const submitButton = fillAndSubmitLoginForm();

    await waitFor(() => {
      expect(submitButton.disabled).toBe(true);
      expect(submitButton.textContent).toBe("ログイン中...");
    });

    await act(async () => {
      resolveLogin({
        ok: true,
      });
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/home");
    });
  });
});
