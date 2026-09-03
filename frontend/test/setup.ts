import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw/server";

process.env.BACKEND_API_ORIGIN = "http://127.0.0.1:8000";
process.env.NEXT_PUBLIC_API_TIMEOUT_MS = "10000";

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

beforeAll(() => {
  server.listen({
    onUnhandledRequest: "error",
  });
});

afterEach(() => {
  server.resetHandlers();

  clearCookie("csrftoken");
  clearCookie("sessionid");
});

afterAll(() => {
  server.close();
});
