import crypto from "node:crypto";

export const TOKEN_REFRESH_LEEWAY_MS = 60_000;

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired. Run `timereport login` again.");
    this.name = "SessionExpiredError";
  }
}

export interface PkceLoginProof {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export function createPkceLoginProof(): PkceLoginProof {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  return {
    state: crypto.randomBytes(32).toString("hex"),
    codeVerifier,
    codeChallenge: crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url"),
  };
}

export function getJwtExpirationMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}

export function accessTokenNeedsRefresh(
  token: string,
  now = Date.now(),
  leewayMs = TOKEN_REFRESH_LEEWAY_MS,
): boolean {
  const expiresAt = getJwtExpirationMs(token);
  return expiresAt === null || expiresAt <= now + leewayMs;
}

export function isAuthorizationCode(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isAuthenticationError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("unauthenticated") ||
    message.includes("token hasn't expired") ||
    message.includes("token has expired")
  );
}

export function isRefreshTokenRejected(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    isAuthenticationError(error) ||
    (message.includes("refresh token") &&
      (message.includes("invalid") ||
        message.includes("expired") ||
        message.includes("reuse")))
  );
}
