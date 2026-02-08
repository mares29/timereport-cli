import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { readConfig } from './config.js'
import chalk from 'chalk'

const PRODUCTION_URL = 'https://veracious-labrador-252.convex.cloud'

/**
 * Resolve a string like "timers:startTimer" into a FunctionReference
 * using anyApi, which allows dynamic access without generated types.
 */
function resolveFn(path: string) {
  const parts = path.split(':')
  if (parts.length !== 2) {
    throw new Error(
      `Invalid function path: "${path}". Expected "module:functionName"`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (anyApi as any)[parts[0]][parts[1]]
}

export interface TypedClient {
  query(path: string, args: Record<string, unknown>): Promise<any>
  mutation(path: string, args: Record<string, unknown>): Promise<any>
}

export function getClient(): TypedClient {
  const config = readConfig()
  if (!config) {
    console.error(chalk.red('Not logged in. Run `timereport login` first.'))
    process.exit(1)
  }

  const raw = new ConvexHttpClient(config.convexUrl || PRODUCTION_URL)
  raw.setAuth(config.token)

  return {
    query: (path, args) => raw.query(resolveFn(path), args),
    mutation: (path, args) => raw.mutation(resolveFn(path), args),
  }
}

export function getUnauthenticatedClient(url?: string): ConvexHttpClient {
  return new ConvexHttpClient(url || PRODUCTION_URL)
}
