"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authApi } from "@/features/auth/api/browser";

export function LogoutButton() {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await authApi.logout();

    if (result.state === "signed-out") {
      router.replace("/login");
      return;
    }

    if (result.state === "still-authenticated") {
      setErrorMessage(
        "セキュリティ検証に失敗したため、ログアウトできませんでした。もう一度お試しください。",
      );
    } else {
      setErrorMessage(
        "ログアウト状態を確認できませんでした。もう一度お試しください。",
      );
    }

    setIsSubmitting(false);
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isSubmitting}
        className="rounded-md border border-black/20 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/30"
      >
        {isSubmitting ? "ログアウト中..." : "ログアウト"}
      </button>

      {errorMessage !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
