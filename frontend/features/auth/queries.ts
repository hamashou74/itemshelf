import "server-only";

import { cache } from "react";

import { redirect } from "next/navigation";

import { getSessionId } from "@/lib/auth/session";
import { fetchCurrentUser } from "@/lib/backend/auth";

export const getCurrentUser = cache(async () => {
  const sessionId = await getSessionId();

  if (sessionId === null) {
    return null;
  }

  return fetchCurrentUser(sessionId);
});

export async function requireCurrentUser() {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    redirect("/login");
  }

  return currentUser;
}
