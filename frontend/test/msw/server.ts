import { setupServer } from "msw/node";

import { getAuthMock } from "@/lib/api/generated/client/auth/auth.msw";

export const server = setupServer(...getAuthMock());
