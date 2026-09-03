import "server-only";

import axios, { type AxiosInstance } from "axios";

import { getApiTimeoutMs, getBackendApiOrigin } from "@/config/api/server";
import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";

export function createServerHttpClient(sessionId: string): AxiosInstance {
  return axios.create({
    baseURL: getBackendApiOrigin(),
    timeout: getApiTimeoutMs(),
    headers: {
      Cookie: `${AUTH_TRANSPORT.session.cookieName}=${sessionId}`,
    },
  });
}
