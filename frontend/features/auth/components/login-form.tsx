"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { authApi } from "@/features/auth/api/browser";

const LOGIN_ERROR_MESSAGES = {
  "invalid-credentials": "ユーザー名またはパスワードが正しくありません。",
  security: "セキュリティ検証に失敗しました。もう一度お試しください。",
  unexpected: "ログインに失敗しました。もう一度お試しください。",
} as const;

type LoginFormState = {
  errorMessage: string | null;
};

const INITIAL_LOGIN_FORM_STATE: LoginFormState = {
  errorMessage: null,
};

export function LoginForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(
    async (
      previousState: LoginFormState,
      formData: FormData,
    ): Promise<LoginFormState> => {
      const result = await authApi.login({
        username: String(formData.get("username") ?? ""),
        password: String(formData.get("password") ?? ""),
      });

      if (result.ok) {
        router.replace("/home");

        return {
          ...previousState,
          errorMessage: null,
        };
      }

      return {
        ...previousState,
        errorMessage: LOGIN_ERROR_MESSAGES[result.reason],
      };
    },
    INITIAL_LOGIN_FORM_STATE,
  );

  return (
    <form className="flex w-full flex-col gap-5" action={formAction}>
      <div className="flex flex-col gap-2">
        <label htmlFor="username" className="text-sm font-medium">
          ユーザー名
        </label>

        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={isPending}
          className="rounded-md border border-black/20 px-3 py-2 outline-none focus:border-black dark:border-white/30 dark:focus:border-white"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          パスワード
        </label>

        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          className="rounded-md border border-black/20 px-3 py-2 outline-none focus:border-black dark:border-white/30 dark:focus:border-white"
        />
      </div>

      {state.errorMessage !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
