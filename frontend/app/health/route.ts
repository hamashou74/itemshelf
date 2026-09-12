import { getApiTimeoutMs, getBackendApiOrigin } from "@/config/backend";
import { getSessionSecret } from "@/config/session";

export function GET(): Response {
  try {
    getApiTimeoutMs();
    getBackendApiOrigin();
    getSessionSecret();
  } catch {
    return new Response("unhealthy", {
      status: 503,
      headers: {
        "content-type": "text/plain",
      },
    });
  }

  return new Response("ok", {
    status: 200,
    headers: {
      "content-type": "text/plain",
    },
  });
}
