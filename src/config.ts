import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export interface Config {
  convexUrl: string;
  token: string;
  refreshToken?: string;
}

const LOCK_ACQUISITION_TIMEOUT_MS = 15_000;
const STALE_LOCK_AGE_MS = 120_000;
const LOCK_RETRY_MS = 50;
const LOCK_HEARTBEAT_MS = 30_000;

export function getConfigDir(): string {
  return (
    process.env.TIMEREPORT_CONFIG_DIR ??
    path.join(os.homedir(), ".config", "timereport")
  );
}

function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

function isConfig(value: unknown): value is Config {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  return (
    typeof config.convexUrl === "string" &&
    typeof config.token === "string" &&
    (config.refreshToken === undefined ||
      typeof config.refreshToken === "string")
  );
}

function ensureConfigDir(): string {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  return dir;
}

export function readConfig(): Config | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;

  try {
    const value: unknown = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return isConfig(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeConfig(config: Config): void {
  ensureConfigDir();
  const configPath = getConfigPath();
  const tempPath = `${configPath}.${process.pid}.${crypto.randomUUID()}.tmp`;

  try {
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    fs.renameSync(tempPath, configPath);
    fs.chmodSync(configPath, 0o600);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

export function clearConfig(): void {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeStaleLock(lockPath: string): boolean {
  let observedFd: number | null = null;
  try {
    observedFd = fs.openSync(lockPath, "r");
    const observedStat = fs.fstatSync(observedFd);
    if (Date.now() - observedStat.mtimeMs <= STALE_LOCK_AGE_MS) return false;

    const observedId = fs.readFileSync(observedFd, "utf8").trim();
    const currentStat = fs.statSync(lockPath);
    const currentId = fs.readFileSync(lockPath, "utf8").trim();
    if (
      currentStat.dev !== observedStat.dev ||
      currentStat.ino !== observedStat.ino ||
      currentId !== observedId
    ) {
      return false;
    }

    fs.unlinkSync(lockPath);
    return true;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code === "ENOENT") return true;
    throw error;
  } finally {
    if (observedFd !== null) fs.closeSync(observedFd);
  }
}

export async function withConfigLock<T>(work: () => Promise<T>): Promise<T> {
  const dir = ensureConfigDir();
  const lockPath = path.join(dir, "config.lock");
  const startedAt = Date.now();
  const lockId = `${process.pid}:${crypto.randomUUID()}`;
  let lockFd: number | null = null;

  while (lockFd === null) {
    try {
      const candidateFd = fs.openSync(lockPath, "wx", 0o600);
      try {
        fs.writeFileSync(candidateFd, `${lockId}\n`);
        lockFd = candidateFd;
      } catch (error) {
        fs.closeSync(candidateFd);
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // Preserve the original write error.
        }
        throw error;
      }
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (code !== "EEXIST") throw error;

      if (removeStaleLock(lockPath)) continue;

      if (Date.now() - startedAt >= LOCK_ACQUISITION_TIMEOUT_MS) {
        throw new Error("Timed out waiting for the authentication lock");
      }
      await delay(LOCK_RETRY_MS);
    }
  }

  const heartbeat = setInterval(() => {
    try {
      if (fs.readFileSync(lockPath, "utf8").trim() === lockId) {
        const now = new Date();
        fs.utimesSync(lockPath, now, now);
      }
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (code !== "ENOENT") clearInterval(heartbeat);
    }
  }, LOCK_HEARTBEAT_MS);
  heartbeat.unref();

  try {
    return await work();
  } finally {
    clearInterval(heartbeat);
    fs.closeSync(lockFd);
    try {
      if (fs.readFileSync(lockPath, "utf8").trim() === lockId) {
        fs.unlinkSync(lockPath);
      }
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (code !== "ENOENT") throw error;
    }
  }
}
