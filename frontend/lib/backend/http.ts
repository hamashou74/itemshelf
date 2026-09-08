import "server-only";

import axios, { AxiosHeaders, type AxiosInstance } from "axios";
import { stringifyCookie } from "cookie";

import { getApiTimeoutMs, getBackendApiOrigin } from "@/config/backend";
import { AUTH_TRANSPORT } from "@/lib/backend/auth-transport";

type AuthContext = {
  sessionId?: string;
  csrfToken?: string;
};

export function createHttpClient(auth: AuthContext = {}): AxiosInstance {
  const backendOrigin = getBackendApiOrigin();
  const cookies: Record<string, string> = {};
  const headers = new AxiosHeaders();

  if (auth.sessionId !== undefined) {
    cookies[AUTH_TRANSPORT.session.cookieName] = auth.sessionId;
  }

  if (auth.csrfToken !== undefined) {
    cookies[AUTH_TRANSPORT.csrf.cookieName] = auth.csrfToken;
    headers.set(AUTH_TRANSPORT.csrf.headerName, auth.csrfToken);
    headers.set("Origin", backendOrigin);
  }

  if (Object.keys(cookies).length > 0) {
    headers.set("Cookie", stringifyCookie(cookies));
  }

  return axios.create({
    baseURL: backendOrigin,
    timeout: getApiTimeoutMs(),
    headers,
    allowAbsoluteUrls: false,
    maxRedirects: 0,
  });
}
