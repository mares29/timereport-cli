const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function invalidDate(input: string): Error {
  return new Error(
    `Invalid date: "${input}". Use YYYY-MM-DD, "today", or "yesterday".`,
  );
}

/**
 * Resolve a log date while preserving the current local time of day.
 *
 * This keeps the existing `log` behavior (the entry ends "now") and moves the
 * same time interval to the requested local calendar date.
 */
export function resolveLogEndTime(
  input: string | undefined,
  now = new Date(),
): number {
  if (input === undefined) return now.getTime();

  const normalized = input.trim().toLowerCase();
  const target = new Date(now);

  if (normalized === "today") {
    return target.getTime();
  }

  if (normalized === "yesterday") {
    target.setDate(target.getDate() - 1);
    return target.getTime();
  }

  const match = ISO_DATE_PATTERN.exec(normalized);
  if (!match) throw invalidDate(input);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  target.setFullYear(year, month - 1, day);

  if (
    target.getFullYear() !== year ||
    target.getMonth() !== month - 1 ||
    target.getDate() !== day
  ) {
    throw invalidDate(input);
  }

  if (target.getTime() > now.getTime()) {
    throw new Error(`Date cannot be in the future: "${input}".`);
  }

  return target.getTime();
}

export function resolveLogTimeRange(
  durationMs: number,
  date: string | undefined,
  now = new Date(),
): { startTime: number; endTime: number } {
  const endTime = resolveLogEndTime(date, now);
  return {
    startTime: endTime - durationMs,
    endTime,
  };
}

export function formatLogDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
