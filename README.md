# timereport-cli

CLI for [timereport.app](https://timereport.app) — manage timers, log time, and view summaries from the terminal.

## Install

```bash
npm install -g timereport-cli
```

Requires Node.js 18+.

## Setup

```bash
timereport login
```

Opens your browser to authenticate. Credentials are stored in `~/.config/timereport/`.

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
```

## License

MIT
