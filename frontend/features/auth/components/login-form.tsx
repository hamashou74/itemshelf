"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { authApi } from "@/features/auth/api/browser";

const LOGIN_ERROR_MESSAGES = {
  "invalid-credentials": "ユーザー名またはパスワードが正しくありません。",
  security: "セキュリティ検証に失敗しました。もう一度お試しください。",
  unexpected: "ログインに失敗しました。もう一度お試しください。",
} as const;

export function LoginForm() {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);

    const result = await authApi.login({
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    if (result.ok) {
      router.replace("/home");
      return;
    }

    setErrorMessage(LOGIN_ERROR_MESSAGES[result.reason]);

    setIsSubmitting(false);
  }

  return (
    <form className="flex w-full flex-col gap-5" onSubmit={handleSubmit}>
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
          disabled={isSubmitting}
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
          disabled={isSubmitting}
          className="rounded-md border border-black/20 px-3 py-2 outline-none focus:border-black dark:border-white/30 dark:focus:border-white"
        />
      </div>

      {errorMessage !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
