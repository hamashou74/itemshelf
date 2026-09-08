import "server-only";

import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";

import { getSessionSecret } from "@/config/session";

export const SESSION_COOKIE_NAME = "itemshelf_session";

type Session = {
  sessionId: string;
  maxAge?: number;
};

type SessionPayload = {
  sessionId: string;
  expiresAt: number | null;
};

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.sessionId === "string" &&
    payload.sessionId !== "" &&
    (payload.expiresAt === null ||
      (typeof payload.expiresAt === "number" &&
        Number.isSafeInteger(payload.expiresAt)))
  );
}

export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sealedSession = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sealedSession === undefined) {
    return null;
  }

  const payload = await unsealData<unknown>(sealedSession, {
    password: getSessionSecret(),
    ttl: 0,
  });

  if (!isSessionPayload(payload)) {
    return null;
  }

  if (payload.expiresAt !== null && payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload.sessionId;
}

export async function setSession(session: Session): Promise<void> {
  const expiresAt =
    session.maxAge === undefined ? null : Date.now() + session.maxAge * 1000;
  const sealedSession = await sealData<SessionPayload>(
    {
      sessionId: session.sessionId,
      expiresAt,
    },
    {
      password: getSessionSecret(),
      ttl: 0,
    },
  );
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sealedSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(session.maxAge === undefined ? {} : { maxAge: session.maxAge }),
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);
}
