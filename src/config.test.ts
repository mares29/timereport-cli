import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readConfig, writeConfig, clearConfig } from "./config.js";
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
    const config = { convexUrl: "https://test.convex.cloud", token: "abc123" };
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
});
