import "server-only";

import { cache } from "react";

import { redirect } from "next/navigation";

import { getWebSessionId } from "@/lib/auth/session";
import { getBackendCurrentUser } from "@/lib/backend/auth";

export const getCurrentUser = cache(async () => {
  const sessionId = await getWebSessionId();

  if (sessionId === null) {
    return null;
  }

  return getBackendCurrentUser(sessionId);
});

export async function requireCurrentUser() {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    redirect("/login");
  }

  return currentUser;
}
