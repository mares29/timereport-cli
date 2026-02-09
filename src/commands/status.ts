import chalk from "chalk";
import ora from "ora";
import { getClient } from "../client.js";
import { formatDuration } from "../duration.js";

export async function status(): Promise<void> {
  const client = getClient();
  const spinner = ora("Fetching status...").start();

  try {
    const [active, today] = await Promise.all([
      client.query("timers:getActiveTimer", {}),
      client.query("timers:getTodaySummary", {}),
    ]);

    spinner.stop();

    // Active timer
    if (active) {
      const elapsed =
        Date.now() - active.startTime - (active.totalPausedDuration || 0);
      const statusColor =
        active.status === "running" ? chalk.green : chalk.yellow;
      const statusLabel = active.status === "running" ? "RUNNING" : "PAUSED";

      console.log(statusColor(`● ${statusLabel}: ${active.taskName}`));
      console.log(chalk.dim(`  Elapsed: ${formatDuration(elapsed)}`));
    } else {
      console.log(chalk.dim("No active timer."));
    }

    // Today summary
    console.log();
    console.log(chalk.bold("Today"));
    console.log(`  Hours: ${chalk.cyan(today.hours.toFixed(1) + "h")}`);
    console.log(`  Entries: ${chalk.cyan(String(today.entryCount))}`);
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    );
  }
}
