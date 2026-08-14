# timereport-cli

[![CI](https://github.com/mares29/timereport-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/mares29/timereport-cli/actions/workflows/ci.yml)

CLI for [timereport.app](https://timereport.app) — manage timers, log time, and view summaries from the terminal.

## Install from source

```bash
git clone https://github.com/mares29/timereport-cli.git
cd timereport-cli
npm ci --ignore-scripts
npm run build
npm link
```

The npm package is not published yet. An `npm install -g` command will be added
only after the first verified publication.

Requires Node.js 20+.

## Setup

```bash
timereport login
```

Opens your browser to authenticate. Credentials are stored in `~/.config/timereport/`.
The browser sends a short-lived one-time code protected by PKCE; session tokens
never pass through the localhost callback URL. The CLI refreshes its one-hour
access token automatically. The separate CLI session lasts up to 30 days by
default, or until logout or server-side revocation.

## Usage

### Timers

```bash
timereport start "Feature work" -p "My Project"
timereport pause
timereport resume
timereport stop
```

### Manual time entry

```bash
timereport log 1h30m "Code review" -p "My Project"
timereport log 45m "Standup meeting"
timereport log 2h "Feature work" --date yesterday
timereport log 1h "Client call" --date 2026-07-12
```

Duration format: `1h30m`, `2h`, `45m`, `1.5h`

Use `--date` (or `-d`) to log time on a past local calendar date. Accepted
values are `YYYY-MM-DD`, `today`, and `yesterday`. Without `--date`, the entry
ends at the current time as before.

### Status & summaries

```bash
timereport status   # active timer + today's hours
timereport today    # today's breakdown
timereport week     # weekly bar chart
```

### Auth

```bash
timereport login    # authenticate via browser
timereport logout   # clear stored credentials
```

## Development

```bash
npm install
npm run build       # compile TypeScript
npm run dev         # watch mode
npm test            # run tests
npm run check       # test and compile
npm run release:check # validate the releasable package
npm run publish:check # validate an npm publication without publishing
```

Maintainers: see [docs/RELEASING.md](docs/RELEASING.md) for the SemVer, tag,
GitHub Release, and npm publication process.

## License

MIT
