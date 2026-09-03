import "server-only";

import { cache } from "react";

import axios from "axios";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";
import { getAuth } from "@/lib/api/generated/client/auth/auth";
import { CurrentUser as CurrentUserSchema } from "@/lib/api/generated/validation/schemas";
import { createServerHttpClient } from "@/lib/api/http/server";

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get(AUTH_TRANSPORT.session.cookieName);

  if (sessionCookie === undefined) {
    return null;
  }

  const generatedAuthApi = getAuth(createServerHttpClient(sessionCookie.value));

  try {
    const response = await generatedAuthApi.authMeRetrieve();

    return CurrentUserSchema.parse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      return null;
    }

    throw error;
  }
});

export async function requireCurrentUser() {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    redirect("/login");
  }

  return currentUser;
}
