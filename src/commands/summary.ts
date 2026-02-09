import chalk from "chalk";
import ora from "ora";
import { getClient } from "../client.js";

export async function todaySummary(): Promise<void> {
  const client = getClient();
  const spinner = ora("Fetching today summary...").start();

  try {
    const today = await client.query("timers:getTodaySummary", {});

    spinner.stop();

    console.log(chalk.bold("Today"));
    console.log(`  Total: ${chalk.cyan(today.hours.toFixed(1) + "h")}`);
    console.log(`  Entries: ${chalk.cyan(String(today.entryCount))}`);
    if (today.diff !== 0) {
      const diffColor = today.diff > 0 ? chalk.green : chalk.red;
      console.log(
        `  vs yesterday: ${diffColor((today.diff > 0 ? "+" : "") + today.diff.toFixed(1) + "h")}`,
      );
    }
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    );
  }
}

export async function weekSummary(): Promise<void> {
  const client = getClient();
  const spinner = ora("Fetching weekly summary...").start();

  try {
    const week = await client.query("timers:getWeeklyHours", {});

    spinner.stop();

    console.log(chalk.bold("This Week"));
    console.log();

    for (const day of week.days) {
      const bar = "█".repeat(Math.round(day.hours * 2));
      const isToday = day.date === new Date().toISOString().split("T")[0];
      const label = isToday ? chalk.bold(day.dayName) : day.dayName;
      const hours =
        day.hours > 0 ? chalk.cyan(day.hours.toFixed(1) + "h") : chalk.dim("—");

      console.log(
        `  ${label.padEnd(isToday ? 13 : 9)} ${hours.padStart(10)}  ${chalk.green(bar)}`,
      );
    }

    console.log();
    console.log(
      `  Total: ${chalk.cyan.bold(week.weeklyTotal.toFixed(1) + "h")}`,
    );
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    );
  }
}
