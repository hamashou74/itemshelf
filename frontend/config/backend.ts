const DEFAULT_BACKEND_API_ORIGIN = "http://127.0.0.1:8000";

export function getBackendApiOrigin(): string {
  const value = process.env.BACKEND_API_ORIGIN ?? DEFAULT_BACKEND_API_ORIGIN;

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
