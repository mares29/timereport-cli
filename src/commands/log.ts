import chalk from "chalk";
import ora from "ora";
import { getClient } from "../client.js";
import { parseDuration, formatDuration } from "../duration.js";
import {
  formatLogDate,
  resolveLogTimeRange,
} from "../log-date.js";

export async function logEntry(
  duration: string,
  description: string,
  options: { project?: string; task?: string; date?: string },
): Promise<void> {
  let durationMs: number;
  try {
    durationMs = parseDuration(duration);
  } catch (err) {
    console.error(
      chalk.red(err instanceof Error ? err.message : "Invalid duration"),
    );
    return;
  }

  let timeRange: { startTime: number; endTime: number };
  try {
    timeRange = resolveLogTimeRange(durationMs, options.date);
  } catch (err) {
    console.error(
      chalk.red(err instanceof Error ? err.message : "Invalid date"),
    );
    return;
  }

  const client = getClient();
  const spinner = ora("Logging time entry...").start();

  try {
    let projectId: string | undefined;

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
      projectId = match._id;
    }

    await client.mutation("timers:createManualEntry", {
      taskName: options.task || description,
      taskDescription: description,
      projectId,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
    });

    spinner.succeed(
      chalk.green(`Logged ${formatDuration(durationMs)}: ${description}`) +
        (options.project ? chalk.dim(` (${options.project})`) : "") +
        (options.date
          ? chalk.dim(` on ${formatLogDate(timeRange.endTime)}`)
          : ""),
    );
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    );
  }
}
