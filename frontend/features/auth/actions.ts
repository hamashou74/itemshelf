"use server";

import { redirect } from "next/navigation";

import type {
  LoginActionState,
  LogoutActionState,
} from "@/features/auth/types";
import { LoginRequest as LoginRequestSchema } from "@/lib/api/generated/validation/schemas";
import { clearSession, getSessionId, setSession } from "@/lib/auth/session";
import { login, logout } from "@/lib/backend/auth";

const LOGIN_ERROR_MESSAGES = {
  "invalid-credentials": "ユーザー名またはパスワードが正しくありません。",
  security: "セキュリティ検証に失敗しました。もう一度お試しください。",
  unexpected: "ログインに失敗しました。もう一度お試しください。",
} as const;

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsedCredentials = LoginRequestSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsedCredentials.success) {
    return {
      errorMessage: "ユーザー名とパスワードを入力してください。",
    };
  }

  const result = await login(parsedCredentials.data);

  if (!result.ok) {
    return {
      errorMessage: LOGIN_ERROR_MESSAGES[result.reason],
    };
  }

  await setSession({
    sessionId: result.sessionId,
    ...(result.maxAge === undefined ? {} : { maxAge: result.maxAge }),
  });

  redirect("/home");
}

export async function logoutAction(
  _previousState: LogoutActionState,
): Promise<LogoutActionState> {
  const sessionId = await getSessionId();

  if (sessionId === null) {
    await clearSession();
    redirect("/login");
  }

  const result = await logout(sessionId);

  if (result.ok || result.reason === "unauthenticated") {
    await clearSession();
    redirect("/login");
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
