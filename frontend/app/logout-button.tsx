"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getCsrfToken } from "@/lib/csrf";

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setError(null);
    setIsSubmitting(true);

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "X-CSRFToken": csrfToken,
        },
        credentials: "same-origin",
        cache: "no-store",
      });

      if (response.ok) {
        router.replace("/login");
        router.refresh();
        return;
      }

      if (response.status === 403) {
        setError("Security check failed. Refresh the page and try again.");
      } else {
        setError("Logout failed. Please try again.");
      }
    } catch {
      setError("Unable to reach the authentication service.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700"
        type="button"
        onClick={handleLogout}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing out…" : "Sign out"}
      </button>
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
