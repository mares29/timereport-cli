import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  accessTokenNeedsRefresh,
  createPkceLoginProof,
  getJwtExpirationMs,
  isAuthorizationCode,
} from "./auth-session.js";

function jwtWithExpiration(expirationSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({ exp: expirationSeconds }),
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("createPkceLoginProof", () => {
  it("creates a valid state, verifier, and S256 challenge", () => {
    const proof = createPkceLoginProof();

    expect(proof.state).toMatch(/^[a-f0-9]{64}$/);
    expect(proof.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(proof.codeChallenge).toBe(
      createHash("sha256")
        .update(proof.codeVerifier)
        .digest("base64url"),
    );
  });

  it("creates unique proofs", () => {
    expect(createPkceLoginProof()).not.toEqual(createPkceLoginProof());
  });
});

describe("JWT expiration", () => {
  it("reads expiration from a JWT", () => {
    expect(getJwtExpirationMs(jwtWithExpiration(1_800_000_000))).toBe(
      1_800_000_000_000,
    );
  });

  it("refreshes within the expiry leeway", () => {
    const now = 1_800_000_000_000;
    expect(
      accessTokenNeedsRefresh(jwtWithExpiration(1_800_000_059), now),
    ).toBe(true);
    expect(
      accessTokenNeedsRefresh(jwtWithExpiration(1_800_000_061), now),
    ).toBe(false);
  });

  it("refreshes malformed tokens", () => {
    expect(getJwtExpirationMs("not-a-jwt")).toBeNull();
    expect(accessTokenNeedsRefresh("not-a-jwt")).toBe(true);
  });
});

describe("isAuthorizationCode", () => {
  it("accepts only a 32-byte lowercase hex code", () => {
    expect(isAuthorizationCode("a".repeat(64))).toBe(true);
    expect(isAuthorizationCode("A".repeat(64))).toBe(false);
    expect(isAuthorizationCode("a".repeat(63))).toBe(false);
  });
});
