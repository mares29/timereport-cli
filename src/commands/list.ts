import chalk from "chalk";
import ora from "ora";
import { getClient } from "../client.js";
import { formatDuration } from "../duration.js";
import { formatLogDate } from "../log-date.js";
import {
  groupByDay,
  resolveDateRange,
  resolveMonthRange,
  type DateRange,
} from "../date-range.js";

const PAGE_SIZE = 200;

interface RangeEntry {
  name: string;
  description?: string;
  projectName: string;
  startTime: number;
  endTime?: number;
  durationMs: number;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
  });
  return `${weekday} ${date}`;
}

async function listRange(
  range: DateRange,
  options: { project?: string },
): Promise<void> {
  const client = getClient();
  const spinner = ora("Fetching time entries...").start();

  try {
    let projectIds: string[] | undefined;

    if (options.project) {
      const projects = await client.query("projects:getAllProjects", {});
      const match = projects.find(
        (p: { name: string }) =>
          p.name.toLowerCase() === options.project!.toLowerCase(),
      );
      if (!match) {
        spinner.fail(`Project not found: "${options.project}"`);
        const names = projects.map((p: { name: string }) => p.name).join(", ");
        if (names) console.log(chalk.dim(`Available: ${names}`));
        return;
      }
      projectIds = [match._id];
    }

    const entries: RangeEntry[] = [];
    let offset = 0;
    for (;;) {
      const page = await client.query("timeEntryQueries:getTimeEntriesByDateRange", {
        startDate: range.startDate,
        endDate: range.endDate,
        projectIds,
        sortField: "date",
        sortOrder: "asc",
        limit: PAGE_SIZE,
        offset,
      });
      if (!page) throw new Error("Could not fetch time entries");
      entries.push(...page.entries);
      if (!page.pagination.hasMore) break;
      offset += PAGE_SIZE;
    }

    spinner.stop();

    const header = `${formatLogDate(range.startDate)} → ${formatLogDate(range.endDate)}`;
    console.log(
      chalk.bold(header) + (options.project ? chalk.dim(` (${options.project})`) : ""),
    );
    console.log();

    if (entries.length === 0) {
      console.log(chalk.dim("  No entries."));
      return;
    }

    let totalMs = 0;
    for (const day of groupByDay(entries)) {
      const dayMs = day.items.reduce((sum, e) => sum + e.durationMs, 0);
      totalMs += dayMs;
      console.log(
        `${chalk.bold(dayLabel(day.date))}  ${chalk.cyan(formatDuration(dayMs))}`,
      );

      for (const entry of day.items) {
        const end = entry.endTime ? formatTime(entry.endTime) : "…";
        const time = chalk.dim(`${formatTime(entry.startTime)}–${end}`);
        const duration = formatDuration(entry.durationMs).padStart(7);
        const project =
          !options.project && entry.projectName
            ? chalk.dim(` (${entry.projectName})`)
            : "";
        console.log(`  ${time}  ${chalk.cyan(duration)}  ${entry.name}${project}`);
      }
      console.log();
    }

    console.log(
      `Total: ${chalk.cyan.bold(formatDuration(totalMs))}` +
        chalk.dim(` · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`),
    );
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    );
  }
}

export async function listEntries(options: {
  from?: string;
  to?: string;
  project?: string;
}): Promise<void> {
  let range: DateRange;
  try {
    range = resolveDateRange(options);
  } catch (err) {
    console.error(chalk.red(err instanceof Error ? err.message : "Invalid date range"));
    return;
  }
  await listRange(range, options);
}

export async function monthEntries(
  month: string | undefined,
  options: { project?: string },
): Promise<void> {
  let range: DateRange;
  try {
    range = resolveMonthRange(month);
  } catch (err) {
    console.error(chalk.red(err instanceof Error ? err.message : "Invalid month"));
    return;
  }
  await listRange(range, options);
}
