import crypto from "node:crypto";
import http from "node:http";
import readline from "node:readline";
import chalk from "chalk";
import open from "open";
import { writeConfig, clearConfig, readConfig } from "../config.js";

const CONVEX_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.convex\.cloud$/;

const CALLBACK_PORT = 7284;
const APP_URL = "https://timereport.app";
const LOGIN_TIMEOUT_MS = 300_000;

interface LoginResult {
  type: "success";
  token: string;
  convexUrl: string;
  email?: string;
}

interface LoginCancel {
  type: "cancelled" | "timeout" | "error";
  message: string;
}

function waitForCallback(
  server: http.Server,
  expectedState: string,
  signal: AbortSignal,
): Promise<LoginResult | LoginCancel> {
  return new Promise((resolve) => {
    const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url ?? "/", `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname !== "/callback") return;

      const state = url.searchParams.get("state");
      if (state !== expectedState) {
        res.writeHead(403, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authentication failed.</h1><p>Invalid state parameter. You can close this tab.</p></body></html>",
        );
        resolve({
          type: "error",
          message: "Invalid state parameter — possible CSRF attack",
        });
        return;
      }

      const token = url.searchParams.get("token");
      const convexUrl = url.searchParams.get("convexUrl");
      const email = url.searchParams.get("email");

      if (!token || !convexUrl) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authentication failed.</h1><p>Missing token. You can close this tab.</p></body></html>",
        );
        resolve({ type: "error", message: "Missing token in callback" });
        return;
      }

      if (!CONVEX_URL_PATTERN.test(convexUrl)) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authentication failed.</h1><p>Invalid server URL. You can close this tab.</p></body></html>",
        );
        resolve({
          type: "error",
          message: `Rejected invalid Convex URL: ${convexUrl}`,
        });
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<html><body><h1>Logged in!</h1><p>You can close this tab and return to the terminal.</p></body></html>",
      );
      resolve({ type: "success", token, convexUrl, email: email ?? undefined });
    };

    server.on("request", handler);
    signal.addEventListener("abort", () =>
      server.removeListener("request", handler),
    );
  });
}

function waitForCancel(signal: AbortSignal): Promise<LoginCancel> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    const cleanup = () => rl.close();

    rl.once("line", () => {
      cleanup();
      resolve({ type: "cancelled", message: "Login cancelled." });
    });
    rl.once("close", () => {
      resolve({ type: "cancelled", message: "Login cancelled." });
    });

    signal.addEventListener("abort", cleanup);
  });
}

function waitForTimeout(ms: number, signal: AbortSignal): Promise<LoginCancel> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        type: "timeout",
        message: "Login timed out (5 minutes). Try again.",
      });
    }, ms);

    signal.addEventListener("abort", () => clearTimeout(timer));
  });
}

export async function login(): Promise<void> {
  const existing = readConfig();
  if (existing) {
    console.log(
      chalk.yellow(
        "Already logged in. Run `timereport logout` first to switch accounts.",
      ),
    );
    return;
  }

  const server = http.createServer();

  try {
    await new Promise<void>((resolve, reject) => {
      server.listen(CALLBACK_PORT, "127.0.0.1", resolve);
      server.on("error", reject);
    });
  } catch (err) {
    console.error(
      chalk.red(
        `Failed to start callback server: ${err instanceof Error ? err.message : err}`,
      ),
    );
    return;
  }

  const state = crypto.randomBytes(32).toString("hex");
  const callbackUrl = `http://localhost:${CALLBACK_PORT}/callback`;
  const authUrl = `${APP_URL}/cli-auth?callback=${encodeURIComponent(callbackUrl)}&state=${state}`;

  console.log(chalk.dim("Opening browser for login..."));
  console.log(chalk.dim("Press Enter to cancel.\n"));
  open(authUrl);

  const ac = new AbortController();

  const result = await Promise.race([
    waitForCallback(server, state, ac.signal),
    waitForCancel(ac.signal),
    waitForTimeout(LOGIN_TIMEOUT_MS, ac.signal),
  ]);

  ac.abort();
  server.close();

  if (result.type === "success") {
    writeConfig({ convexUrl: result.convexUrl, token: result.token });
    console.log(
      chalk.green(`Logged in${result.email ? ` as ${result.email}` : ""}.`),
    );
  } else {
    console.log(chalk.yellow(result.message));
  }
}

export function logout(): void {
  const config = readConfig();
  if (!config) {
    console.log(chalk.yellow("Not logged in."));
    return;
  }

  clearConfig();
  console.log(chalk.green("Logged out."));
}
