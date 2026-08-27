import { cookies } from "next/headers";

const djangoApiOrigin = (
  process.env.DJANGO_API_ORIGIN ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export type CurrentUser = {
  id: string;
};

function isCurrentUser(value: unknown): value is CurrentUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  );
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sessionCookie = (await cookies()).get("sessionid");

  if (!sessionCookie) {
    return null;
  }

  const response = await fetch(`${djangoApiOrigin}/api/auth/me`, {
    headers: {
      Cookie: `sessionid=${sessionCookie.value}`,
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Current-user request failed with ${response.status}.`);
  }

  const data: unknown = await response.json();

  if (!isCurrentUser(data)) {
    throw new Error("Current-user response did not match the expected shape.");
  }

  return data;
}
