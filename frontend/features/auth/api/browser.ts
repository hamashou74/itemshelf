import axios from "axios";

import { withCsrf } from "@/lib/api/csrf";
import { getAuth } from "@/lib/api/generated/client/auth/auth";
import type { LoginRequest } from "@/lib/api/generated/models";
import { browserHttpClient } from "@/lib/api/http/browser";

const generatedAuthApi = getAuth(browserHttpClient);

export type LoginResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: "invalid-credentials" | "security" | "unexpected";
    };

export type LogoutResult =
  | {
      state: "signed-out";
    }
  | {
      state: "still-authenticated";
      reason: "security";
    }
  | {
      state: "unknown";
      reason: "unexpected";
    };

async function login(credentials: LoginRequest): Promise<LoginResult> {
  try {
    await withCsrf(() => generatedAuthApi.authLoginCreate(credentials));

    return {
      ok: true,
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

async function isSessionActive(): Promise<boolean | null> {
  try {
    await generatedAuthApi.authMeRetrieve();

    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      return false;
    }

    return null;
  }
}

async function logout(): Promise<LogoutResult> {
  try {
    await withCsrf(() => generatedAuthApi.authLogoutCreate());

    return {
      state: "signed-out",
    };
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 403) {
      return {
        state: "unknown",
        reason: "unexpected",
      };
    }

    const sessionActive = await isSessionActive();

    if (sessionActive === false) {
      return {
        state: "signed-out",
      };
    }

    if (sessionActive === true) {
      return {
        state: "still-authenticated",
        reason: "security",
      };
    }

    return {
      state: "unknown",
      reason: "unexpected",
    };
  }
}

export const authApi = {
  login,
  logout,
} as const;
