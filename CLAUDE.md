# timereport-cli

CLI for timereport.app — manage timers, log time, view summaries.

## Stack

- TypeScript (ES2022, ESM via `"type": "module"`)
- Commander.js for CLI framework
- Convex HTTP client for backend (no generated types — uses `anyApi`)
- chalk for terminal colors, ora for spinners
- vitest for testing

## Commands

- `npm run build` — compile TS to `dist/`
- `npm run dev` — watch mode
- `npm test` — `vitest run`
- `npm run test:watch` — `vitest`
- `node dist/index.js` or `timereport` (if linked)

## Architecture

```
src/
  index.ts          — CLI entry point (Commander setup)
  client.ts         — Convex HTTP client wrapper with auth
  config.ts         — Config file read/write (~/.config/timereport/)
  duration.ts       — Duration parsing/formatting (1h30m format)
  commands/
    auth.ts         — Login (browser OAuth callback) / logout
    timer.ts        — start/stop/pause/resume timers
    log.ts          — Manual time entry logging
    status.ts       — Active timer + today summary
    summary.ts      — Today/week breakdowns
```

## Conventions

- Imports use `.js` extension (ESM resolution)
- Convex functions addressed as `"module:functionName"` strings (e.g., `"timers:startTimer"`)
- Config stored at `$TIMEREPORT_CONFIG_DIR` or `~/.config/timereport/config.json`
- Tests use `TIMEREPORT_CONFIG_DIR` env var for isolation
- All command handlers follow pattern: get client → spinner → try/catch → spinner.succeed/fail
- Project lookup by name is case-insensitive
- Duration format: `1h30m`, `2h`, `45m`, `1.5h` (parsed to ms internally)

## Convex API Surface

Queries: `timers:getActiveTimer`, `timers:getTodaySummary`, `timers:getWeeklyHours`, `projects:getAllProjects`
Mutations: `timers:startTimer`, `timers:stopTimer`, `timers:pauseTimer`, `timers:resumeTimer`, `timers:createManualEntry`

## Testing

- Tests co-located with source (`*.test.ts` in `src/`)
- Config tests use `os.tmpdir()` with env var override
- Only pure logic tested currently (config, duration) — command handlers untested
