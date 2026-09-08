import "server-only";

import { z } from "zod";

const BACKEND_API_ORIGIN_REQUIRED = "BACKEND_API_ORIGIN is required.";
const BACKEND_API_ORIGIN_PROTOCOL =
  "BACKEND_API_ORIGIN must use the http or https protocol.";
const BACKEND_API_ORIGIN_SHAPE =
  "BACKEND_API_ORIGIN must contain only an origin, for example http://127.0.0.1:8000.";
const API_TIMEOUT_REQUIRED = "API_TIMEOUT_MS is required.";
const API_TIMEOUT_INVALID = "API_TIMEOUT_MS must be a positive integer.";

const BackendApiOriginSchema = z
  .string({ error: BACKEND_API_ORIGIN_REQUIRED })
  .trim()
  .min(1, { error: BACKEND_API_ORIGIN_REQUIRED })
  .pipe(
    z.url({
      protocol: /^https?$/,
      error: BACKEND_API_ORIGIN_PROTOCOL,
    }),
  )
  .refine(
    (value) => {
      const url = new URL(value);

      return url.pathname === "/" && url.search === "" && url.hash === "";
    },
    { error: BACKEND_API_ORIGIN_SHAPE },
  )
  .transform((value) => new URL(value).origin);

const ApiTimeoutMsSchema = z
  .string({ error: API_TIMEOUT_REQUIRED })
  .trim()
  .min(1, { error: API_TIMEOUT_REQUIRED })
  .pipe(z.coerce.number({ error: API_TIMEOUT_INVALID }))
  .pipe(
    z
      .int({ error: API_TIMEOUT_INVALID })
      .positive({ error: API_TIMEOUT_INVALID }),
  );

export function getBackendApiOrigin(): string {
  return BackendApiOriginSchema.parse(process.env.BACKEND_API_ORIGIN);
}

export function getApiTimeoutMs(): number {
  return ApiTimeoutMsSchema.parse(process.env.API_TIMEOUT_MS);
}
