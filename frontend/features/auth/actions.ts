"use server";

import { redirect } from "next/navigation";

import type {
  LoginActionState,
  LogoutActionState,
} from "@/features/auth/types";
import { clearSession, getSessionId, setSession } from "@/lib/auth/session";
import {
  login,
  logout,
  parseLoginCredentials,
} from "@/lib/backend/auth";

const LOGIN_ERROR_MESSAGES = {
  "invalid-credentials": "ユーザー名またはパスワードが正しくありません。",
  security: "セキュリティ検証に失敗しました。もう一度お試しください。",
  unexpected: "ログインに失敗しました。もう一度お試しください。",
} as const;

export async function loginAction(
  previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  void previousState;

  const parsedCredentials = parseLoginCredentials({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (parsedCredentials === null) {
    return {
      errorMessage: "ユーザー名とパスワードを入力してください。",
    };
  }

  const result = await login(parsedCredentials);

  if (!result.ok) {
    return {
      errorMessage: LOGIN_ERROR_MESSAGES[result.reason],
    };
  }

  await setSession({
    sessionId: result.sessionId,
    ...(result.maxAge === undefined ? {} : { maxAge: result.maxAge }),
  });

  return redirect("/home");
}

export async function logoutAction(
  previousState: LogoutActionState,
): Promise<LogoutActionState> {
  void previousState;

  const sessionId = await getSessionId();

  if (sessionId === null) {
    await clearSession();
    return redirect("/login");
  }

  const result = await logout(sessionId);

  if (result.ok || result.reason === "unauthenticated") {
    await clearSession();
    return redirect("/login");
  }

  if (result.reason === "security") {
    return {
      errorMessage:
        "セキュリティ検証に失敗したため、ログアウトできませんでした。もう一度お試しください。",
    };
  }

  return {
    errorMessage: "ログアウトに失敗しました。もう一度お試しください。",
  };
}
