import "server-only";

import axios, { type AxiosResponse } from "axios";

import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";
import { getAuth } from "@/lib/api/generated/client/auth/auth";
import type { LoginRequest } from "@/lib/api/generated/models";
import { CurrentUser as CurrentUserSchema } from "@/lib/api/generated/validation/schemas";
import { createBackendHttpClient } from "@/lib/backend/http";

export type BackendLoginResult =
  | {
      ok: true;
      sessionId: string;
      maxAge?: number;
    }
  | {
      ok: false;
      reason: "invalid-credentials" | "security" | "unexpected";
    };

export type BackendLogoutResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: "unauthenticated" | "security" | "unexpected";
    };

type ResponseCookie = {
  value: string;
  maxAge?: number;
};

function getSetCookieHeaders(response: AxiosResponse): string[] {
  const setCookie = response.headers["set-cookie"];

  if (Array.isArray(setCookie)) {
    return setCookie.filter(
      (headerValue): headerValue is string => typeof headerValue === "string",
    );
  }

  if (typeof setCookie === "string") {
    return [setCookie];
  }

  return [];
}

function getResponseCookie(
  response: AxiosResponse,
  cookieName: string,
): ResponseCookie | null {
  for (const setCookie of getSetCookieHeaders(response)) {
    const [cookiePair, ...attributes] = setCookie.split(";");
    const separatorIndex = cookiePair.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookiePair.slice(0, separatorIndex).trim();

    if (name !== cookieName) {
      continue;
    }

    const value = cookiePair.slice(separatorIndex + 1).trim();
    let maxAge: number | undefined;

    for (const attribute of attributes) {
      const [attributeName, attributeValue] = attribute.trim().split("=", 2);

      if (attributeName.toLowerCase() !== "max-age") {
        continue;
      }

      const parsedMaxAge = Number(attributeValue);

      if (Number.isSafeInteger(parsedMaxAge) && parsedMaxAge >= 0) {
        maxAge = parsedMaxAge;
      }
    }

    return {
      value,
      ...(maxAge === undefined ? {} : { maxAge }),
    };
  }

  return null;
}

async function getBackendCsrfToken(sessionId?: string): Promise<string> {
  const generatedAuthApi = getAuth(
    createBackendHttpClient(
      sessionId === undefined
        ? undefined
        : {
            sessionId,
          },
    ),
  );

  const response = await generatedAuthApi.authCsrfRetrieve();
  const csrfCookie = getResponseCookie(
    response,
    AUTH_TRANSPORT.csrf.cookieName,
  );

  if (csrfCookie === null || csrfCookie.value === "") {
    throw new Error("Backend did not return the expected CSRF cookie.");
  }

  return csrfCookie.value;
}

export async function loginBackend(
  credentials: LoginRequest,
): Promise<BackendLoginResult> {
  try {
    const csrfToken = await getBackendCsrfToken();
    const generatedAuthApi = getAuth(
      createBackendHttpClient({
        csrfToken,
      }),
    );

    const response = await generatedAuthApi.authLoginCreate(credentials);
    const sessionCookie = getResponseCookie(
      response,
      AUTH_TRANSPORT.session.cookieName,
    );

    if (sessionCookie === null || sessionCookie.value === "") {
      return {
        ok: false,
        reason: "unexpected",
      };
    }

    return {
      ok: true,
      sessionId: sessionCookie.value,
      ...(sessionCookie.maxAge === undefined
        ? {}
        : { maxAge: sessionCookie.maxAge }),
    };
  } catch (error) {
    if (!axios.isAxiosError(error)) {
      return {
        ok: false,
        reason: "unexpected",
      };
    }

    switch (error.response?.status) {
      case 400:
        return {
          ok: false,
          reason: "invalid-credentials",
        };

      case 403:
        return {
          ok: false,
          reason: "security",
        };

      default:
        return {
          ok: false,
          reason: "unexpected",
        };
    }
  }
}

export async function logoutBackend(
  sessionId: string,
): Promise<BackendLogoutResult> {
  try {
    const csrfToken = await getBackendCsrfToken(sessionId);
    const generatedAuthApi = getAuth(
      createBackendHttpClient({
        sessionId,
        csrfToken,
      }),
    );

    await generatedAuthApi.authLogoutCreate();

    return {
      ok: true,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      try {
        const currentUser = await getBackendCurrentUser(sessionId);

        if (currentUser === null) {
          return {
            ok: false,
            reason: "unauthenticated",
          };
        }
      } catch {
        return {
          ok: false,
          reason: "unexpected",
        };
      }

      return {
        ok: false,
        reason: "security",
      };
    }

    return {
      ok: false,
      reason: "unexpected",
    };
  }
}

export async function getBackendCurrentUser(sessionId: string) {
  const generatedAuthApi = getAuth(
    createBackendHttpClient({
      sessionId,
    }),
  );

  try {
    const response = await generatedAuthApi.authMeRetrieve();

    return CurrentUserSchema.parse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      return null;
    }

    throw error;
  }
}
