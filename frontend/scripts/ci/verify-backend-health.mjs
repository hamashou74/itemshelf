const origin = process.env.BACKEND_API_ORIGIN;
const timeoutValue = process.env.API_TIMEOUT_MS;

if (!origin) {
  throw new Error("BACKEND_API_ORIGIN is not configured.");
}

const timeoutMs = Number(timeoutValue);

if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
  throw new Error("API_TIMEOUT_MS must be a positive integer.");
}

const healthUrl = new URL("/api/health", origin);
const response = await fetch(healthUrl, {
  signal: AbortSignal.timeout(timeoutMs),
});
const body = await response.text();

if (response.status !== 200) {
  throw new Error(
    `Backend health returned HTTP ${response.status}: ${body}`,
  );
}

let payload;

try {
  payload = JSON.parse(body);
} catch (error) {
  throw new Error(`Backend health returned invalid JSON: ${body}`, {
    cause: error,
  });
}

if (
  payload === null ||
  typeof payload !== "object" ||
  payload.status !== "ok"
) {
  throw new Error(`Backend health returned unexpected payload: ${body}`);
}
