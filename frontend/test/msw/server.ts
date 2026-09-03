import { setupServer } from "msw/node";

import * as generatedMocks from "@/lib/api/generated/client/index.msw";

const handlers = Object.entries(generatedMocks).flatMap(([, getMock]) =>
  getMock(),
);

export const server = setupServer(...handlers);
