export function getBackendApiOrigin(): string {
  const value = process.env.BACKEND_API_ORIGIN;

  if (value === undefined || value.trim() === "") {
    throw new Error("BACKEND_API_ORIGIN is required.");
  }

  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BACKEND_API_ORIGIN must use the http or https protocol.");
  }

  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new Error(
      "BACKEND_API_ORIGIN must contain only an origin, for example http://127.0.0.1:8000.",
    );
  }

  return url.origin;
}

export function getApiTimeoutMs(): number {
  const value = process.env.API_TIMEOUT_MS;

  if (value === undefined || value.trim() === "") {
    throw new Error("API_TIMEOUT_MS is required.");
  }

  const timeoutMs = Number(value);

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("API_TIMEOUT_MS must be a positive integer.");
  }

  return timeoutMs;
}
