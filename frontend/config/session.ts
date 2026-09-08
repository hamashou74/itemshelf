import "server-only";

const MIN_SESSION_SECRET_LENGTH = 32;

export function getSessionSecret(): string {
  const value = process.env.SESSION_SECRET;

  if (value === undefined || value.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters.`,
    );
  }

  return value;
}
