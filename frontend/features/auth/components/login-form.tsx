"use client";

import { useActionState } from "react";

import { login } from "@/features/auth/actions";
import { INITIAL_LOGIN_ACTION_STATE } from "@/features/auth/types";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    login,
    INITIAL_LOGIN_ACTION_STATE,
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
