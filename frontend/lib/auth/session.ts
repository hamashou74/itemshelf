import "server-only";

import { cookies } from "next/headers";

export const WEB_SESSION_COOKIE_NAME = "itemshelf_session";

type WebSession = {
  sessionId: string;
  maxAge?: number;
};

export async function getWebSessionId(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(WEB_SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setWebSession(session: WebSession): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(WEB_SESSION_COOKIE_NAME, session.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(session.maxAge === undefined ? {} : { maxAge: session.maxAge }),
  });
}

export async function clearWebSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(WEB_SESSION_COOKIE_NAME);
}
