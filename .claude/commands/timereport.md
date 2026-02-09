# timereport CLI Skill

You can use the `timereport` CLI to track time on behalf of the user. This document teaches you how.

## Prerequisites

- The `timereport` CLI must be installed and available in PATH
- The user must be authenticated (`timereport login` completed previously)
- Do NOT run `timereport login` or `timereport logout` without explicit user consent

## Commands Reference

### `timereport start <task>`

Start a timer for a task.

```
timereport start "Implement auth module"
timereport start "Bug fix" -p Acme
```

| Flag                   | Description                                   |
| ---------------------- | --------------------------------------------- |
| `-p, --project <name>` | Assign to a project (case-insensitive lookup) |

- Only one timer can be active at a time
- If a project name doesn't match, the CLI prints available projects

### `timereport stop`

Stop the currently active timer.

```
timereport stop
```

- Prints the task name and total elapsed duration
- No-ops with a message if no timer is active

### `timereport pause`

Pause the currently active timer.

```
timereport pause
```

- Paused time is not counted toward the entry
- No-ops if already paused or no timer is active

### `timereport resume`

Resume a paused timer.

```
timereport resume
```

- No-ops if already running or no timer is active

### `timereport log <duration> <description>`

Log a completed time entry retroactively (no timer needed).

```
timereport log 1h30m "Code review for PR #42"
timereport log 2h "Sprint planning" -p Acme
timereport log 45m "Standup" -p Acme -t "Meetings"
```

| Flag                   | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `-p, --project <name>` | Assign to a project (case-insensitive lookup)  |
| `-t, --task <name>`    | Task name (defaults to description if omitted) |

### `timereport status`

Show the active timer and today's summary.

```
timereport status
```

Output includes:

- Active timer state (RUNNING / PAUSED) with elapsed time, or "No active timer"
- Today's total hours and entry count

### `timereport today`

Show today's hours breakdown.

```
timereport today
```

Output includes:

- Total hours today
- Entry count
- Comparison vs yesterday (e.g., +1.5h or -0.5h)

### `timereport week`

Show this week's hours breakdown by day.

```
timereport week
```

Output includes:

- Hours per day with a bar chart
- Weekly total

### `timereport login`

Authenticate via browser OAuth. Opens a browser window.

### `timereport logout`

Clear stored credentials.

## Duration Format

Durations use the `XhYm` format. Hours support decimals.

| Valid   | Meaning           |
| ------- | ----------------- |
| `1h30m` | 1 hour 30 minutes |
| `2h`    | 2 hours           |
| `45m`   | 45 minutes        |
| `1.5h`  | 1 hour 30 minutes |
| `0.25h` | 15 minutes        |

| Invalid  | Why                       |
| -------- | ------------------------- |
| `90`     | No unit                   |
| `1h 30m` | No spaces allowed         |
| `1:30`   | Wrong format              |
| `0h`     | Must be greater than zero |
| `0m`     | Must be greater than zero |
| `0h0m`   | Must be greater than zero |

## Common Workflows

### Start and stop a work session

```bash
timereport start "Implement feature X" -p MyProject
# ... user works ...
timereport stop
```

### Log time retroactively

```bash
timereport log 1h30m "Meeting with client" -p Acme
```

### Check what's running before starting

```bash
timereport status
# If a timer is active, stop it first
timereport stop
timereport start "New task"
```

### Pause and resume during a break

```bash
timereport pause
# ... break ...
timereport resume
```

### Review the day or week

```bash
timereport today
timereport week
```

## Error Handling

| Error                            | Cause                                            | Action                                                   |
| -------------------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| `Project not found: "X"`         | Project name doesn't exist                       | Check the printed "Available" list and use an exact name |
| `Invalid duration: "X"`          | Bad duration format                              | Use `XhYm` format (see Duration Format above)            |
| `No active timer.`               | Trying to stop/pause/resume with nothing running | Check `timereport status` first                          |
| `Already logged in.`             | Running login when already authenticated         | Run `timereport logout` first if switching accounts      |
| Not authenticated / token errors | Session expired or not logged in                 | Run `timereport login` (with user consent)               |

## Safety Rules

1. **Never run `timereport login` or `timereport logout` without explicit user consent** — these affect authentication state
2. **Check `timereport status` before starting a new timer** — only one timer can be active; starting blindly may cause confusion
3. **Confirm before running `timereport stop`** — stopping discards the active timer's "live" state; the entry is finalized
4. **Do not invent project names** — project lookup is against real data; use names the user provides or that appear in error output
5. **Quote task descriptions** — descriptions with spaces must be quoted in the shell
6. **Prefer `timereport log` for past work** — if the user describes work already completed, log it retroactively rather than start/stop a timer
