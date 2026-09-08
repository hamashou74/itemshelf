import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw/server";

process.env.BACKEND_API_ORIGIN = "http://127.0.0.1:8000";
process.env.API_TIMEOUT_MS = "10000";

beforeAll(() => {
  server.listen({
    onUnhandledRequest: "error",
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
