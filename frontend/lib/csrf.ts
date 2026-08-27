"use client";

const CSRF_COOKIE_NAME = "csrftoken";

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(prefix.length));
}

export async function getCsrfToken(): Promise<string> {
  let token = readCookie(CSRF_COOKIE_NAME);

  if (token) {
    return token;
  }

  const response = await fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CSRF bootstrap failed with ${response.status}.`);
  }

  token = readCookie(CSRF_COOKIE_NAME);

  if (!token) {
    throw new Error("CSRF cookie was not set by the backend.");
  }

  return token;
}
