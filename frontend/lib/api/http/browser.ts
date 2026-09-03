import axios from "axios";

import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";

export const browserHttpClient = axios.create({
  xsrfCookieName: AUTH_TRANSPORT.csrf.cookieName,
  xsrfHeaderName: AUTH_TRANSPORT.csrf.headerName,
});
