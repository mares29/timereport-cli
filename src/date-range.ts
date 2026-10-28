import { formatLogDate } from "./log-date.js";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export interface DateRange {
  /** Local midnight of the first day (inclusive). */
  startDate: number;
  /** Last millisecond of the final day (inclusive). */
  endDate: number;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

/**
 * Parse a calendar date (YYYY-MM-DD, "today", or "yesterday") to local
 * midnight of that day.
 */
export function parseDay(input: string, now = new Date()): Date {
  const normalized = input.trim().toLowerCase();

  if (normalized === "today") return startOfDay(now);

  if (normalized === "yesterday") {
    const date = startOfDay(now);
    date.setDate(date.getDate() - 1);
    return date;
  }

  const match = ISO_DATE_PATTERN.exec(normalized);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  throw new Error(
    `Invalid date: "${input}". Use YYYY-MM-DD, "today", or "yesterday".`,
  );
}

/**
 * Resolve --from/--to into an inclusive range. Defaults to the first day of
 * the current month through today.
 */
export function resolveDateRange(
  options: { from?: string; to?: string },
  now = new Date(),
): DateRange {
  const from = options.from
    ? parseDay(options.from, now)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = options.to ? parseDay(options.to, now) : startOfDay(now);

  if (to.getTime() < from.getTime()) {
    throw new Error(
      `--to (${formatLogDate(to.getTime())}) is before --from (${formatLogDate(from.getTime())}).`,
    );
  }

  return { startDate: from.getTime(), endDate: endOfDay(to).getTime() };
}

/** Resolve a month (YYYY-MM, defaults to the current month) to its full range. */
export function resolveMonthRange(
  input: string | undefined,
  now = new Date(),
): DateRange {
  let year = now.getFullYear();
  let monthIndex = now.getMonth();

  if (input !== undefined) {
    const match = ISO_MONTH_PATTERN.exec(input.trim());
    const month = match ? Number(match[2]) : 0;
    if (!match || month < 1 || month > 12) {
      throw new Error(`Invalid month: "${input}". Use YYYY-MM.`);
    }
    year = Number(match[1]);
    monthIndex = month - 1;
  }

  return {
    startDate: new Date(year, monthIndex, 1).getTime(),
    endDate: endOfDay(new Date(year, monthIndex + 1, 0)).getTime(),
  };
}

/** Group items by local calendar day (YYYY-MM-DD), preserving input order. */
export function groupByDay<T extends { startTime: number }>(
  items: T[],
): Array<{ date: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = formatLogDate(item.startTime);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([date, items]) => ({ date, items }));
}
