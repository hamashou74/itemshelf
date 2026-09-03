import Cookies from "js-cookie";

import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";
import { getAuth } from "@/lib/api/generated/client/auth/auth";
import { browserHttpClient } from "@/lib/api/http/browser";

const generatedAuthApi = getAuth(browserHttpClient);

export async function ensureCsrfCookie(): Promise<void> {
  const cookieName = AUTH_TRANSPORT.csrf.cookieName;

  if (Cookies.get(cookieName) !== undefined) {
    return;
  }

  await generatedAuthApi.authCsrfRetrieve();

  if (Cookies.get(cookieName) === undefined) {
    throw new Error("Backend did not set the expected CSRF cookie.");
  }
}

export async function withCsrf<T>(request: () => Promise<T>): Promise<T> {
  await ensureCsrfCookie();

  return request();
}
