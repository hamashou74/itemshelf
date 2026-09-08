"use client";

import { useActionState } from "react";

import { logout } from "@/features/auth/actions";
import { INITIAL_LOGOUT_ACTION_STATE } from "@/features/auth/types";

export function LogoutButton() {
  const [state, formAction, isPending] = useActionState(
    logout,
    INITIAL_LOGOUT_ACTION_STATE,
  );

  return (
    <form className="flex flex-col items-start gap-3" action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-black/20 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/30"
      >
        {isPending ? "ログアウト中..." : "ログアウト"}
      </button>

      {state.errorMessage !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.errorMessage}
        </p>
      )}
    </form>
  );
}
