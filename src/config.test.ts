import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readConfig,
  writeConfig,
  clearConfig,
  withConfigLock,
} from "./config.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const TEST_DIR = path.join(os.tmpdir(), "timereport-cli-test");

describe("config", () => {
  beforeEach(() => {
    process.env.TIMEREPORT_CONFIG_DIR = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    delete process.env.TIMEREPORT_CONFIG_DIR;
  });

  it("returns null when no config exists", () => {
    expect(readConfig()).toBeNull();
  });

  it("writes and reads config", () => {
    const config = {
      convexUrl: "https://test.convex.cloud",
      token: "abc123",
      refreshToken: "refresh123",
    };
    writeConfig(config);
    expect(readConfig()).toEqual(config);
  });

  it("creates config directory if missing", () => {
    writeConfig({ convexUrl: "https://test.convex.cloud", token: "abc" });
    expect(fs.existsSync(TEST_DIR)).toBe(true);
  });

  it("clears config", () => {
    writeConfig({ convexUrl: "https://test.convex.cloud", token: "abc" });
    clearConfig();
    expect(readConfig()).toBeNull();
  });

  it("uses private permissions for the directory and config", () => {
    writeConfig({ convexUrl: "https://test.convex.cloud", token: "abc" });

    expect(fs.statSync(TEST_DIR).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(TEST_DIR, "config.json")).mode & 0o777).toBe(
      0o600,
    );
  });

  it("returns null for malformed or invalid config", () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, "config.json"), "not-json");
    expect(readConfig()).toBeNull();

    fs.writeFileSync(
      path.join(TEST_DIR, "config.json"),
      JSON.stringify({ convexUrl: "https://test.convex.cloud" }),
    );
    expect(readConfig()).toBeNull();
  });

  it("leaves no temporary file after an atomic write", () => {
    writeConfig({ convexUrl: "https://test.convex.cloud", token: "abc" });
    expect(fs.readdirSync(TEST_DIR).sort()).toEqual(["config.json"]);
  });

  it("recovers a stale authentication lock", async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    const lockPath = path.join(TEST_DIR, "config.lock");
    fs.writeFileSync(lockPath, "abandoned-lock\n", { mode: 0o600 });
    const staleTime = new Date(Date.now() - 121_000);
    fs.utimesSync(lockPath, staleTime, staleTime);

    await expect(withConfigLock(async () => "acquired")).resolves.toBe(
      "acquired",
    );
    expect(fs.existsSync(lockPath)).toBe(false);
  });
});
