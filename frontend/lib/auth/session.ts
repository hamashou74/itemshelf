import "server-only";

import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "itemshelf_session";

type Session = {
  sessionId: string;
  maxAge?: number;
};

export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setSession(session: Session): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, session.sessionId, {
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
