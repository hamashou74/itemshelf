import "server-only";

import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { parseSetCookie } from "cookie";

import { AUTH_TRANSPORT } from "@/lib/api/auth-transport";
import { getAuth } from "@/lib/backend/generated/client/auth/auth";
import type { LoginRequest } from "@/lib/backend/generated/models";
import {
  CurrentUser as CurrentUserSchema,
  LoginRequest as LoginRequestSchema,
} from "@/lib/backend/generated/validation/schemas";
import { createHttpClient } from "@/lib/backend/http";

export type LoginResult =
  | {
      ok: true;
      sessionId: string;
      maxAge?: number;
    }
  | {
      ok: false;
      reason: "invalid-credentials" | "security" | "unexpected";
    };

export type LogoutResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: "unauthenticated" | "security" | "unexpected";
    };

export function parseLoginCredentials(value: unknown): LoginRequest | null {
  const parsedCredentials = LoginRequestSchema.safeParse(value);

  return parsedCredentials.success ? parsedCredentials.data : null;
}

function getSetCookieHeaders(response: AxiosResponse): string[] {
  if (response.headers instanceof AxiosHeaders) {
    return response.headers.getSetCookie();
  }

  const setCookie = response.headers["set-cookie"];

  if (Array.isArray(setCookie)) {
    return setCookie;
  }

  return typeof setCookie === "string" ? [setCookie] : [];
}

function findResponseCookie(response: AxiosResponse, cookieName: string) {
  for (const header of getSetCookieHeaders(response)) {
    const responseCookie = parseSetCookie(header);

    if (responseCookie.name === cookieName) {
      return responseCookie;
    }
  }

  return null;
}

async function fetchCsrfToken(sessionId?: string): Promise<string> {
  const authApi = getAuth(
    createHttpClient(
      sessionId === undefined
        ? undefined
        : {
            sessionId,
          },
    ),
  );

  const response = await authApi.authCsrfRetrieve();
  const csrfCookie = findResponseCookie(
    response,
    AUTH_TRANSPORT.csrf.cookieName,
  );

  if (
    csrfCookie === null ||
    csrfCookie.value === undefined ||
    csrfCookie.value === ""
  ) {
    throw new Error("Django did not return the expected CSRF cookie.");
  }

  return csrfCookie.value;
}

export async function login(credentials: LoginRequest): Promise<LoginResult> {
  try {
    const csrfToken = await fetchCsrfToken();
    const authApi = getAuth(
      createHttpClient({
        csrfToken,
      }),
    );

    const response = await authApi.authLoginCreate(credentials);
    const sessionCookie = findResponseCookie(
      response,
      AUTH_TRANSPORT.session.cookieName,
    );

    if (
      sessionCookie === null ||
      sessionCookie.value === undefined ||
      sessionCookie.value === ""
    ) {
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

export async function logout(sessionId: string): Promise<LogoutResult> {
  try {
    const csrfToken = await fetchCsrfToken(sessionId);
    const authApi = getAuth(
      createHttpClient({
        sessionId,
        csrfToken,
      }),
    );

    await authApi.authLogoutCreate();

    return {
      ok: true,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      try {
        const currentUser = await fetchCurrentUser(sessionId);

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

export async function fetchCurrentUser(sessionId: string) {
  const authApi = getAuth(
    createHttpClient({
      sessionId,
    }),
  );

  try {
    const response = await authApi.authMeRetrieve();

    return CurrentUserSchema.parse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      return null;
    }

    throw error;
  }
}
