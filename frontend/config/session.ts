import "server-only";

import { z } from "zod";

const SESSION_SECRET_ERROR = "SESSION_SECRET must be at least 32 characters.";

const SessionSecretSchema = z
  .string({ error: SESSION_SECRET_ERROR })
  .min(32, { error: SESSION_SECRET_ERROR });

export function getSessionSecret(): string {
  return SessionSecretSchema.parse(process.env.SESSION_SECRET);
}
