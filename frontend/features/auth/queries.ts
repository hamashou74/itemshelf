import "server-only";

import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";
import { getBackendCurrentUser } from "@/lib/backend/auth";

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get(AUTH_TRANSPORT.session.cookieName);

  if (sessionCookie === undefined) {
    return null;
  }

  return getBackendCurrentUser(sessionCookie.value);
});

export async function requireCurrentUser() {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    redirect("/login");
  }

  return currentUser;
}
