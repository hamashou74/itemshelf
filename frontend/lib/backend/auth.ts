import "server-only";

import axios from "axios";

import { getAuth } from "@/lib/api/generated/client/auth/auth";
import { CurrentUser as CurrentUserSchema } from "@/lib/api/generated/validation/schemas";
import { createBackendHttpClient } from "@/lib/backend/http";

export async function getBackendCurrentUser(sessionId: string) {
  const generatedAuthApi = getAuth(createBackendHttpClient(sessionId));

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
