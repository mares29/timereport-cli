import { describe, expect, it } from "vitest";
import {
  groupByDay,
  parseDay,
  resolveDateRange,
  resolveMonthRange,
} from "./date-range.js";

const NOW = new Date(2026, 9, 28, 14, 45, 12, 345);

describe("parseDay", () => {
  it("supports today and yesterday at local midnight", () => {
    expect(parseDay("today", NOW)).toEqual(new Date(2026, 9, 28));
    expect(parseDay("Yesterday", NOW)).toEqual(new Date(2026, 9, 27));
  });

  it("supports ISO dates", () => {
    expect(parseDay("2026-02-03", NOW)).toEqual(new Date(2026, 1, 3));
  });

  it("rejects invalid calendar dates and formats", () => {
    expect(() => parseDay("2026-02-30", NOW)).toThrow("Invalid date");
    expect(() => parseDay("03/02/2026", NOW)).toThrow("Invalid date");
  });
});

describe("resolveDateRange", () => {
  it("defaults to the start of the current month through end of today", () => {
    expect(resolveDateRange({}, NOW)).toEqual({
      startDate: new Date(2026, 9, 1).getTime(),
      endDate: new Date(2026, 9, 28, 23, 59, 59, 999).getTime(),
    });
  });

  it("makes --to inclusive of the whole day", () => {
    expect(
      resolveDateRange({ from: "2026-09-01", to: "2026-09-15" }, NOW),
    ).toEqual({
      startDate: new Date(2026, 8, 1).getTime(),
      endDate: new Date(2026, 8, 15, 23, 59, 59, 999).getTime(),
    });
  });

  it("accepts a single-day range", () => {
    const range = resolveDateRange({ from: "today", to: "today" }, NOW);
    expect(range.startDate).toBe(new Date(2026, 9, 28).getTime());
  });

  it("rejects --to before --from", () => {
    expect(() =>
      resolveDateRange({ from: "2026-10-10", to: "2026-10-01" }, NOW),
    ).toThrow("before --from");
  });
});

describe("resolveMonthRange", () => {
  it("defaults to the current month", () => {
    expect(resolveMonthRange(undefined, NOW)).toEqual({
      startDate: new Date(2026, 9, 1).getTime(),
      endDate: new Date(2026, 9, 31, 23, 59, 59, 999).getTime(),
    });
  });

  it("handles February in a leap year", () => {
    expect(resolveMonthRange("2028-02", NOW).endDate).toBe(
      new Date(2028, 1, 29, 23, 59, 59, 999).getTime(),
    );
  });

  it("rejects invalid months", () => {
    expect(() => resolveMonthRange("2026-13", NOW)).toThrow("Invalid month");
    expect(() => resolveMonthRange("october", NOW)).toThrow("Invalid month");
  });
});

describe("groupByDay", () => {
  it("groups by local calendar day preserving order", () => {
    const a = { startTime: new Date(2026, 9, 1, 9).getTime() };
    const b = { startTime: new Date(2026, 9, 1, 23, 30).getTime() };
    const c = { startTime: new Date(2026, 9, 2, 0, 15).getTime() };

    expect(groupByDay([a, b, c])).toEqual([
      { date: "2026-10-01", items: [a, b] },
      { date: "2026-10-02", items: [c] },
    ]);
  });
});
