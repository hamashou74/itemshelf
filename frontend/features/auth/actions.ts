"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import type {
  LoginActionState,
  LogoutActionState,
} from "@/features/auth/types";
import { loginBackend, logoutBackend } from "@/lib/backend/auth";
import {
  clearWebSession,
  getWebSessionId,
  setWebSession,
} from "@/lib/auth/session";

const LOGIN_FORM_SCHEMA = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const LOGIN_ERROR_MESSAGES = {
  "invalid-credentials": "ユーザー名またはパスワードが正しくありません。",
  security: "セキュリティ検証に失敗しました。もう一度お試しください。",
  unexpected: "ログインに失敗しました。もう一度お試しください。",
} as const;

export async function login(
  previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  void previousState;

  const parsedCredentials = LOGIN_FORM_SCHEMA.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsedCredentials.success) {
    return {
      errorMessage: "ユーザー名とパスワードを入力してください。",
    };
  }

  const result = await loginBackend(parsedCredentials.data);

  if (!result.ok) {
    return {
      errorMessage: LOGIN_ERROR_MESSAGES[result.reason],
    };
  }

  await setWebSession({
    sessionId: result.sessionId,
    ...(result.maxAge === undefined ? {} : { maxAge: result.maxAge }),
  });

  redirect("/home");
}

export async function logout(
  previousState: LogoutActionState,
): Promise<LogoutActionState> {
  void previousState;

  const sessionId = await getWebSessionId();

  if (sessionId === null) {
    redirect("/login");
  }

  const result = await logoutBackend(sessionId);

  if (result.ok || result.reason === "unauthenticated") {
    await clearWebSession();
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
