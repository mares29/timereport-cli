import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import {
  readConfig,
  writeConfig,
  withConfigLock,
  type Config,
} from "./config.js";
import chalk from "chalk";
import {
  accessTokenNeedsRefresh,
  errorMessage,
  isAuthenticationError,
  isRefreshTokenRejected,
  SessionExpiredError,
} from "./auth-session.js";

const PRODUCTION_URL = "https://veracious-labrador-252.convex.cloud";

/**
 * Resolve a string like "timers:startTimer" into a FunctionReference
 * using anyApi, which allows dynamic access without generated types.
 */
function resolveFn(path: string) {
  const parts = path.split(":");
  if (parts.length !== 2) {
    throw new Error(
      `Invalid function path: "${path}". Expected "module:functionName"`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (anyApi as any)[parts[0]][parts[1]];
}

export interface TypedClient {
  query(path: string, args: Record<string, unknown>): Promise<any>;
  mutation(path: string, args: Record<string, unknown>): Promise<any>;
  action(path: string, args: Record<string, unknown>): Promise<any>;
}

interface TokenResponse {
  token: string;
  refreshToken: string;
}

function tokensFromResult(result: unknown): TokenResponse | null {
  if (!result || typeof result !== "object") return null;
  const tokens = (result as { tokens?: unknown }).tokens;
  if (!tokens || typeof tokens !== "object") return null;
  const token = (tokens as { token?: unknown }).token;
  const refreshToken = (tokens as { refreshToken?: unknown }).refreshToken;
  return typeof token === "string" && typeof refreshToken === "string"
    ? { token, refreshToken }
    : null;
}

async function requestNewTokens(
  config: Config,
  args: Record<string, unknown>,
  rejectedMessage?: string,
): Promise<TokenResponse> {
  const client = new ConvexHttpClient(config.convexUrl || PRODUCTION_URL);
  const result = await client.action(resolveFn("auth:signIn"), args);
  const tokens = tokensFromResult(result);
  if (!tokens) {
    if (rejectedMessage) throw new Error(rejectedMessage);
    throw new SessionExpiredError();
  }
  return tokens;
}

export async function exchangeAuthorizationCode(
  convexUrl: string,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  return requestNewTokens(
    { convexUrl, token: "" },
    {
      provider: "cli",
      params: { code, codeVerifier },
      calledBy: "timereport-cli",
    },
    "Authorization code was rejected. Run `timereport login` again.",
  );
}

export function getClient(): TypedClient {
  const config = readConfig();
  if (!config) {
    console.error(chalk.red("Not logged in. Run `timereport login` first."));
    process.exit(1);
  }

  const raw = new ConvexHttpClient(config.convexUrl || PRODUCTION_URL);
  raw.setAuth(config.token);

  let currentConfig = config;
  let refreshInFlight: Promise<void> | null = null;

  const applyConfig = (nextConfig: Config) => {
    currentConfig = nextConfig;
    raw.setAuth(nextConfig.token);
  };

  const refreshAccessToken = async (force: boolean): Promise<void> => {
    if (refreshInFlight) return refreshInFlight;

    const tokenBeforeLock = currentConfig.token;
    refreshInFlight = withConfigLock(async () => {
      const latestConfig = readConfig();
      if (!latestConfig) throw new SessionExpiredError();

      if (
        latestConfig.token !== tokenBeforeLock &&
        !accessTokenNeedsRefresh(latestConfig.token)
      ) {
        applyConfig(latestConfig);
        return;
      }

      if (!force && !accessTokenNeedsRefresh(latestConfig.token)) {
        applyConfig(latestConfig);
        return;
      }

      if (!latestConfig.refreshToken) throw new SessionExpiredError();

      let tokens: TokenResponse;
      try {
        tokens = await requestNewTokens(latestConfig, {
          refreshToken: latestConfig.refreshToken,
          calledBy: "timereport-cli",
        });
      } catch (error) {
        if (error instanceof SessionExpiredError || isRefreshTokenRejected(error)) {
          throw new SessionExpiredError();
        }

        // A refresh response can be lost after the server rotated the token.
        // Convex Auth permits immediate parent-token reuse, so retry once while
        // still holding the cross-process lock.
        try {
          tokens = await requestNewTokens(latestConfig, {
            refreshToken: latestConfig.refreshToken,
            calledBy: "timereport-cli",
          });
        } catch (retryError) {
          if (
            retryError instanceof SessionExpiredError ||
            isRefreshTokenRejected(retryError)
          ) {
            throw new SessionExpiredError();
          }
          throw new Error(
            `Could not refresh session: ${errorMessage(retryError)}`,
          );
        }
      }

      const nextConfig: Config = { ...latestConfig, ...tokens };
      writeConfig(nextConfig);
      applyConfig(nextConfig);
    }).finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  };

  const ensureFreshAccessToken = async (): Promise<void> => {
    if (!accessTokenNeedsRefresh(currentConfig.token)) return;
    await refreshAccessToken(false);
  };

  const authenticatedCall = async <T>(call: () => Promise<T>): Promise<T> => {
    await ensureFreshAccessToken();
    try {
      return await call();
    } catch (error) {
      if (!isAuthenticationError(error)) throw error;
      await refreshAccessToken(true);
      return call();
    }
  };

  return {
    query: (path, args) =>
      authenticatedCall(() => raw.query(resolveFn(path), args)),
    mutation: (path, args) =>
      authenticatedCall(() => raw.mutation(resolveFn(path), args)),
    action: (path, args) =>
      authenticatedCall(() => raw.action(resolveFn(path), args)),
  };
}

export function getUnauthenticatedClient(url?: string): ConvexHttpClient {
  return new ConvexHttpClient(url || PRODUCTION_URL);
}
