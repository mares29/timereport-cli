import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface Config {
  convexUrl: string
  token: string
}

export function getConfigDir(): string {
  return (
    process.env.TIMEREPORT_CONFIG_DIR ??
    path.join(os.homedir(), '.config', 'timereport')
  )
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json')
}

export function readConfig(): Config | null {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) return null

  const raw = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(raw) as Config
}

export function writeConfig(config: Config): void {
  const dir = getConfigDir()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), {
    mode: 0o600,
  })
}

export function clearConfig(): void {
  const configPath = getConfigPath()
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath)
  }
}
