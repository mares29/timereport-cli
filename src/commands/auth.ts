import http from "node:http";
import readline from "node:readline";
import chalk from "chalk";
import open from "open";
import {
  writeConfig,
  clearConfig,
  readConfig,
  withConfigLock,
} from "../config.js";
import {
  createPkceLoginProof,
  errorMessage,
  isAuthorizationCode,
  SessionExpiredError,
} from "../auth-session.js";
import { exchangeAuthorizationCode, getClient } from "../client.js";

const CONVEX_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.convex\.cloud$/;

const CALLBACK_PORT = 7284;
const APP_URL = "https://timereport.app";
const LOGIN_TIMEOUT_MS = 300_000;

interface LoginResult {
  type: "success";
  code: string;
  convexUrl: string;
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

      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const responseHeaders = {
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      };

      if (req.method !== "GET") {
        res.writeHead(405, responseHeaders);
        res.end("<html><body><h1>Method not allowed.</h1></body></html>");
        return;
      }

      const state = url.searchParams.get("state");
      if (state !== expectedState) {
        res.writeHead(403, responseHeaders);
        res.end(
          "<html><body><h1>Authentication failed.</h1><p>Invalid state parameter. You can close this tab.</p></body></html>",
        );
        return;
      }

      const code = url.searchParams.get("code");
      const convexUrl = url.searchParams.get("convexUrl");
      if (!code || !isAuthorizationCode(code) || !convexUrl) {
        res.writeHead(400, responseHeaders);
        res.end(
          "<html><body><h1>Authentication failed.</h1><p>Missing or invalid authorization code. You can close this tab.</p></body></html>",
        );
        return;
      }

      if (!CONVEX_URL_PATTERN.test(convexUrl)) {
        res.writeHead(400, responseHeaders);
        res.end(
          "<html><body><h1>Authentication failed.</h1><p>Invalid server URL. You can close this tab.</p></body></html>",
        );
        return;
      }

      res.writeHead(200, responseHeaders);
      res.end(
        "<html><body><h1>Authorization received.</h1><p>You can close this tab and return to the terminal.</p></body></html>",
      );
      resolve({ type: "success", code, convexUrl });
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
    try {
      const authenticated = await getClient().query("auth:isAuthenticated", {});
      if (authenticated) {
        console.log(
          chalk.yellow(
            "Already logged in. Run `timereport logout` first to switch accounts.",
          ),
        );
        return;
      }
      clearConfig();
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        clearConfig();
        console.log(chalk.dim("Stored session expired. Starting a new login."));
      } else {
        console.error(
          chalk.red(`Could not verify stored session: ${errorMessage(error)}`),
        );
        return;
      }
    }
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

  const { state, codeVerifier, codeChallenge } = createPkceLoginProof();
  const callbackUrl = `http://127.0.0.1:${CALLBACK_PORT}/callback`;
  const authUrl = new URL("/cli-auth-v2", APP_URL);
  authUrl.searchParams.set("callback", callbackUrl);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("codeChallenge", codeChallenge);
  authUrl.searchParams.set("protocol", "2");

  console.log(chalk.dim("Opening browser for login..."));
  console.log(chalk.dim("Press Enter to cancel.\n"));
  open(authUrl.toString());

  const ac = new AbortController();

  const result = await Promise.race([
    waitForCallback(server, state, ac.signal),
    waitForCancel(ac.signal),
    waitForTimeout(LOGIN_TIMEOUT_MS, ac.signal),
  ]);

  ac.abort();
  server.close();

  if (result.type === "success") {
    try {
      const tokens = await exchangeAuthorizationCode(
        result.convexUrl,
        result.code,
        codeVerifier,
      );
      writeConfig({ convexUrl: result.convexUrl, ...tokens });
      console.log(chalk.green("Logged in."));
    } catch (error) {
      console.error(
        chalk.red(`Authentication failed: ${errorMessage(error)}`),
      );
    }
  } else {
    console.log(chalk.yellow(result.message));
  }
}

export async function logout(): Promise<void> {
  const config = readConfig();
  if (!config) {
    console.log(chalk.yellow("Not logged in."));
    return;
  }

  let remoteError: unknown = null;
  try {
    await getClient().action("auth:signOut", {});
  } catch (error) {
    remoteError = error;
  }

  await withConfigLock(async () => clearConfig());
  if (remoteError) {
    console.log(chalk.yellow("Local credentials cleared."));
    console.log(
      chalk.yellow(`Server session could not be revoked: ${errorMessage(remoteError)}`),
    );
  } else {
    console.log(chalk.green("Logged out."));
  }
}
