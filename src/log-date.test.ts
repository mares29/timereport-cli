import { describe, expect, it } from "vitest";
import {
  formatLogDate,
  resolveLogEndTime,
  resolveLogTimeRange,
} from "./log-date.js";

const NOW = new Date(2026, 6, 30, 14, 45, 12, 345);

describe("resolveLogEndTime", () => {
  it("uses the current time when no date is provided", () => {
    expect(resolveLogEndTime(undefined, NOW)).toBe(NOW.getTime());
  });

  it("supports today", () => {
    expect(resolveLogEndTime("today", NOW)).toBe(NOW.getTime());
  });

  it("supports yesterday in local time", () => {
    const result = new Date(resolveLogEndTime("yesterday", NOW));

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(29);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(45);
  });

  it("supports an ISO date and preserves the local time of day", () => {
    const result = new Date(resolveLogEndTime("2026-07-12", NOW));

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(12);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(45);
    expect(result.getSeconds()).toBe(12);
    expect(result.getMilliseconds()).toBe(345);
  });

  it("rejects invalid dates and formats", () => {
    expect(() => resolveLogEndTime("2026-02-29", NOW)).toThrow(
      'Invalid date: "2026-02-29"',
    );
    expect(() => resolveLogEndTime("July 12", NOW)).toThrow(
      'Invalid date: "July 12"',
    );
  });

  it("rejects future dates", () => {
    expect(() => resolveLogEndTime("2026-07-31", NOW)).toThrow(
      'Date cannot be in the future: "2026-07-31"',
    );
  });
});

describe("resolveLogTimeRange", () => {
  it("moves the complete duration to the requested date", () => {
    const durationMs = 90 * 60 * 1000;
    const range = resolveLogTimeRange(durationMs, "2026-07-12", NOW);

    expect(range.endTime - range.startTime).toBe(durationMs);
    expect(formatLogDate(range.endTime)).toBe("2026-07-12");
  });
});

describe("formatLogDate", () => {
  it("formats a timestamp as a local ISO date", () => {
    expect(formatLogDate(NOW.getTime())).toBe("2026-07-30");
  });
});
