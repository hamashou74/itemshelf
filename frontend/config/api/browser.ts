export function getApiTimeoutMs(): number {
  const value = process.env.NEXT_PUBLIC_API_TIMEOUT_MS;

  if (value === undefined || value.trim() === "") {
    throw new Error("NEXT_PUBLIC_API_TIMEOUT_MS is required.");
  }

  const timeoutMs = Number(value);

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("NEXT_PUBLIC_API_TIMEOUT_MS must be a positive integer.");
  }

  return timeoutMs;
}
