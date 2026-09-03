import axios from "axios";

import { getApiTimeoutMs } from "@/config/backend";
import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";

export const browserHttpClient = axios.create({
  timeout: getApiTimeoutMs(),
  xsrfCookieName: AUTH_TRANSPORT.csrf.cookieName,
  xsrfHeaderName: AUTH_TRANSPORT.csrf.headerName,
});