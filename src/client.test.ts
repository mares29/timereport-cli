import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
  setAuth: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth(token: string) {
      mocks.setAuth(token);
    }

    query(reference: unknown, args: Record<string, unknown>) {
      return mocks.query(reference, args);
    }

    mutation(reference: unknown, args: Record<string, unknown>) {
      return mocks.mutation(reference, args);
    }

    action(reference: unknown, args: Record<string, unknown>) {
      return mocks.action(reference, args);
    }
  },
}));

import { SessionExpiredError } from "./auth-session.js";
import { exchangeAuthorizationCode, getClient } from "./client.js";
import { readConfig, writeConfig } from "./config.js";

let testDir: string;

function jwtWithExpiration(expirationSeconds: number): string {
  const header = Buffer.from("{}").toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ exp: expirationSeconds }),
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}

function expiredToken(): string {
  return jwtWithExpiration(Math.floor(Date.now() / 1000) - 60);
}

function validToken(): string {
  return jwtWithExpiration(Math.floor(Date.now() / 1000) + 3600);
}

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "timereport-client-test-"));
  process.env.TIMEREPORT_CONFIG_DIR = testDir;
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
  delete process.env.TIMEREPORT_CONFIG_DIR;
});

describe("authenticated client", () => {
  it("exchanges the one-time code through the CLI credentials provider", async () => {
    mocks.action.mockResolvedValueOnce({
      tokens: { token: "access-token", refreshToken: "refresh-token" },
    });

    await expect(
      exchangeAuthorizationCode(
        "https://test.convex.cloud",
        "a".repeat(64),
        "verifier",
      ),
    ).resolves.toEqual({
      token: "access-token",
      refreshToken: "refresh-token",
    });

    expect(mocks.action).toHaveBeenCalledTimes(1);
    expect(mocks.action.mock.calls[0][1]).toEqual({
      provider: "cli",
      params: { code: "a".repeat(64), codeVerifier: "verifier" },
      calledBy: "timereport-cli",
    });
    expect(mocks.setAuth).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and persists both rotated tokens", async () => {
    writeConfig({
      convexUrl: "https://test.convex.cloud",
      token: expiredToken(),
      refreshToken: "old-refresh",
    });
    const nextToken = validToken();
    mocks.action.mockResolvedValueOnce({
      tokens: { token: nextToken, refreshToken: "new-refresh" },
    });
    mocks.query.mockResolvedValueOnce("result");

    await expect(getClient().query("timers:getActiveTimer", {})).resolves.toBe(
      "result",
    );

    expect(mocks.action).toHaveBeenCalledTimes(1);
    expect(mocks.action.mock.calls[0][1]).toEqual({
      refreshToken: "old-refresh",
      calledBy: "timereport-cli",
    });
    expect(readConfig()).toEqual({
      convexUrl: "https://test.convex.cloud",
      token: nextToken,
      refreshToken: "new-refresh",
    });
  });

  it("uses one refresh for concurrent calls", async () => {
    writeConfig({
      convexUrl: "https://test.convex.cloud",
      token: expiredToken(),
      refreshToken: "old-refresh",
    });
    mocks.action.mockResolvedValueOnce({
      tokens: { token: validToken(), refreshToken: "new-refresh" },
    });
    mocks.query.mockResolvedValue("result");
    const client = getClient();

    await Promise.all([
      client.query("timers:getActiveTimer", {}),
      client.query("timers:getTodaySummary", {}),
    ]);

    expect(mocks.action).toHaveBeenCalledTimes(1);
  });

  it("re-reads rotated credentials after waiting for another client", async () => {
    writeConfig({
      convexUrl: "https://test.convex.cloud",
      token: expiredToken(),
      refreshToken: "old-refresh",
    });
    mocks.action.mockResolvedValueOnce({
      tokens: { token: validToken(), refreshToken: "new-refresh" },
    });
    mocks.query.mockResolvedValue("result");
    const firstClient = getClient();
    const secondClient = getClient();

    await Promise.all([
      firstClient.query("timers:getActiveTimer", {}),
      secondClient.query("timers:getTodaySummary", {}),
    ]);

    expect(mocks.action).toHaveBeenCalledTimes(1);
  });

  it("retries once after an authentication rejection", async () => {
    writeConfig({
      convexUrl: "https://test.convex.cloud",
      token: validToken(),
      refreshToken: "old-refresh",
    });
    mocks.query
      .mockRejectedValueOnce(new Error('{"code":"Unauthenticated"}'))
      .mockResolvedValueOnce("retried");
    mocks.action.mockResolvedValueOnce({
      tokens: { token: validToken(), refreshToken: "new-refresh" },
    });

    await expect(getClient().query("timers:getActiveTimer", {})).resolves.toBe(
      "retried",
    );
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.action).toHaveBeenCalledTimes(1);
  });

  it("rejects an expired legacy config without a refresh token", async () => {
    writeConfig({
      convexUrl: "https://test.convex.cloud",
      token: expiredToken(),
    });

    await expect(
      getClient().query("timers:getActiveTimer", {}),
    ).rejects.toBeInstanceOf(SessionExpiredError);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("preserves credentials when refresh fails due to the network", async () => {
    const originalConfig = {
      convexUrl: "https://test.convex.cloud",
      token: expiredToken(),
      refreshToken: "old-refresh",
    };
    writeConfig(originalConfig);
    mocks.action.mockRejectedValue(new Error("fetch failed"));

    await expect(
      getClient().query("timers:getActiveTimer", {}),
    ).rejects.toThrow("Could not refresh session: fetch failed");
    expect(mocks.action).toHaveBeenCalledTimes(2);
    expect(readConfig()).toEqual(originalConfig);
  });

  it("reports a rejected refresh token as an expired session", async () => {
    writeConfig({
      convexUrl: "https://test.convex.cloud",
      token: expiredToken(),
      refreshToken: "expired-refresh",
    });
    mocks.action.mockRejectedValueOnce(new Error("Expired refresh token"));

    await expect(
      getClient().query("timers:getActiveTimer", {}),
    ).rejects.toBeInstanceOf(SessionExpiredError);
    expect(mocks.action).toHaveBeenCalledTimes(1);
  });

  it("recovers when the first refresh response is lost", async () => {
    writeConfig({
      convexUrl: "https://test.convex.cloud",
      token: expiredToken(),
      refreshToken: "old-refresh",
    });
    mocks.action
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce({
        tokens: { token: validToken(), refreshToken: "new-refresh" },
      });
    mocks.query.mockResolvedValueOnce("result");

    await expect(getClient().query("timers:getActiveTimer", {})).resolves.toBe(
      "result",
    );
    expect(mocks.action).toHaveBeenCalledTimes(2);
    expect(readConfig()?.refreshToken).toBe("new-refresh");
  });
});
