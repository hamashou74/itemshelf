import "server-only";

import axios, { type AxiosInstance } from "axios";

import { getBackendApiOrigin } from "@/config/backend";
import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";

export function createServerHttpClient(sessionId: string): AxiosInstance {
  return axios.create({
    baseURL: getBackendApiOrigin(),
    headers: {
      Cookie: `${AUTH_TRANSPORT.session.cookieName}=${sessionId}`,
    },
  });
}
