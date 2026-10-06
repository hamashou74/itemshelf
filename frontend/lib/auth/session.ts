import "server-only";

import { getIronSession, type SessionOptions } from "iron-session";
import { cookies, headers } from "next/headers";
import { z } from "zod";

import { getSessionSecret } from "@/config/session";

export const SESSION_COOKIE_NAME = "itemshelf_session";

const SessionInputSchema = z.object({
  sessionId: z.string().min(1),
  maxAge: z.int().positive().optional(),
});

const SessionDataSchema = z
  .object({
    sessionId: z.string().min(1),
    expiresAt: z.int().nullable(),
  })
  .strict();

type SessionInput = z.infer<typeof SessionInputSchema>;
type SessionData = {
  [key: string]: unknown;
  sessionId?: string;
  expiresAt?: number | null;
};

function isLoopbackHost(host: string): boolean {
  const normalizedHost = host.trim().toLowerCase();

  if (normalizedHost.startsWith("[")) {
    return normalizedHost.slice(1, normalizedHost.indexOf("]")) === "::1";
  }

  const hostname = normalizedHost.split(":", 1)[0];

  return hostname === "localhost" || hostname === "127.0.0.1";
}

async function shouldUseSecureCookie(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  const requestHeaders = await headers();
  const forwardedProto = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProto === "https") {
    return true;
  }

  const host = requestHeaders.get("host");

  return host === null || !isLoopbackHost(host);
}

function getSessionOptions(
  secure: boolean,
  maxAge?: number,
): SessionOptions {
  return {
    password: getSessionSecret(),
    cookieName: SESSION_COOKIE_NAME,
    ttl: 0,
    cookieOptions: {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    },
  };
}

async function getSession() {
  const secure = await shouldUseSecureCookie();
  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions(secure),
  );

  return { session, secure };
}

export async function getSessionId(): Promise<string | null> {
  const { session } = await getSession();
  const parsedSession = SessionDataSchema.safeParse(session);

  if (!parsedSession.success) {
    return null;
  }

  if (
    parsedSession.data.expiresAt !== null &&
    parsedSession.data.expiresAt <= Date.now()
  ) {
    return null;
  }

  return parsedSession.data.sessionId;
}

export async function setSession(value: SessionInput): Promise<void> {
  const sessionInput = SessionInputSchema.parse(value);
  const { session, secure } = await getSession();

  for (const key of Object.keys(session)) {
    delete session[key];
  }

  session.sessionId = sessionInput.sessionId;
  session.expiresAt =
    sessionInput.maxAge === undefined
      ? null
      : Date.now() + sessionInput.maxAge * 1000;
  session.updateConfig(getSessionOptions(secure, sessionInput.maxAge));

  await session.save();
}

export async function clearSession(): Promise<void> {
  const { session } = await getSession();

  session.destroy();
}
