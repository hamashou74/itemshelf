import "server-only";

import axios, { type AxiosInstance } from "axios";

import { getApiTimeoutMs, getBackendApiOrigin } from "@/config/backend";
import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";

type AuthContext = {
  sessionId?: string;
  csrfToken?: string;
};

export function createHttpClient(auth: AuthContext = {}): AxiosInstance {
  const cookieValues: string[] = [];
  const headers: Record<string, string> = {};

  if (auth.sessionId !== undefined) {
    cookieValues.push(`${AUTH_TRANSPORT.session.cookieName}=${auth.sessionId}`);
  }

  if (auth.csrfToken !== undefined) {
    cookieValues.push(`${AUTH_TRANSPORT.csrf.cookieName}=${auth.csrfToken}`);
    headers[AUTH_TRANSPORT.csrf.headerName] = auth.csrfToken;
    headers.Origin = getBackendApiOrigin();
  }

  if (cookieValues.length > 0) {
    headers.Cookie = cookieValues.join("; ");
  }

  return axios.create({
    baseURL: getBackendApiOrigin(),
    timeout: getApiTimeoutMs(),
    headers,
  });
}
