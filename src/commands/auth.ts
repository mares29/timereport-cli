import http from 'node:http'
import readline from 'node:readline'
import chalk from 'chalk'
import open from 'open'
import { writeConfig, clearConfig, readConfig } from '../config.js'

const CALLBACK_PORT = 7284
const APP_URL = 'https://timereport.app'
const LOGIN_TIMEOUT_MS = 300_000

interface LoginResult {
  type: 'success'
  token: string
  convexUrl: string
  email?: string
}

interface LoginCancel {
  type: 'cancelled' | 'timeout' | 'error'
  message: string
}

function waitForCallback(
  server: http.Server,
): Promise<LoginResult | LoginCancel> {
  return new Promise((resolve) => {
    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`)

      if (url.pathname !== '/callback') return

      const token = url.searchParams.get('token')
      const convexUrl = url.searchParams.get('convexUrl')
      const email = url.searchParams.get('email')

      if (!token || !convexUrl) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(
          '<html><body><h1>Authentication failed.</h1><p>Missing token. You can close this tab.</p></body></html>',
        )
        resolve({ type: 'error', message: 'Missing token in callback' })
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        '<html><body><h1>Logged in!</h1><p>You can close this tab and return to the terminal.</p></body></html>',
      )
      resolve({ type: 'success', token, convexUrl, email: email ?? undefined })
    })
  })
}

function waitForCancel(): Promise<LoginCancel> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin })
    rl.once('line', () => {
      rl.close()
      resolve({ type: 'cancelled', message: 'Login cancelled.' })
    })
    rl.once('close', () => {
      resolve({ type: 'cancelled', message: 'Login cancelled.' })
    })
  })
}

function waitForTimeout(ms: number): Promise<LoginCancel> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        type: 'timeout',
        message: 'Login timed out (5 minutes). Try again.',
      })
    }, ms)
  })
}

export async function login(): Promise<void> {
  const existing = readConfig()
  if (existing) {
    console.log(
      chalk.yellow(
        'Already logged in. Run `timereport logout` first to switch accounts.',
      ),
    )
    return
  }

  const server = http.createServer()

  try {
    await new Promise<void>((resolve, reject) => {
      server.listen(CALLBACK_PORT, resolve)
      server.on('error', reject)
    })
  } catch (err) {
    console.error(
      chalk.red(
        `Failed to start callback server: ${err instanceof Error ? err.message : err}`,
      ),
    )
    return
  }

  const callbackUrl = `http://localhost:${CALLBACK_PORT}/callback`
  const authUrl = `${APP_URL}/cli-auth?callback=${encodeURIComponent(callbackUrl)}`

  console.log(chalk.dim('Opening browser for login...'))
  console.log(chalk.dim('Press Enter to cancel.\n'))
  open(authUrl)

  const result = await Promise.race([
    waitForCallback(server),
    waitForCancel(),
    waitForTimeout(LOGIN_TIMEOUT_MS),
  ])

  server.close()

  if (result.type === 'success') {
    writeConfig({ convexUrl: result.convexUrl, token: result.token })
    console.log(
      chalk.green(`Logged in${result.email ? ` as ${result.email}` : ''}.`),
    )
  } else {
    console.log(chalk.yellow(result.message))
  }
}

export function logout(): void {
  const config = readConfig()
  if (!config) {
    console.log(chalk.yellow('Not logged in.'))
    return
  }

  clearConfig()
  console.log(chalk.green('Logged out.'))
}
