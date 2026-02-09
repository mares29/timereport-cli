import { describe, it, expect } from "vitest";
import { parseDuration, formatDuration } from "./duration.js";

describe("parseDuration", () => {
  it("parses hours only", () => {
    expect(parseDuration("2h")).toBe(7200000);
  });

  it("parses minutes only", () => {
    expect(parseDuration("45m")).toBe(2700000);
  });

  it("parses hours and minutes", () => {
    expect(parseDuration("1h30m")).toBe(5400000);
  });

  it("parses decimal hours", () => {
    expect(parseDuration("1.5h")).toBe(5400000);
  });

  it("parses decimal with minutes", () => {
    expect(parseDuration("0.5h")).toBe(1800000);
  });

  it("throws on invalid input", () => {
    expect(() => parseDuration("")).toThrow();
    expect(() => parseDuration("abc")).toThrow();
    expect(() => parseDuration("0h0m")).toThrow();
  });

  it("throws on negative values", () => {
    expect(() => parseDuration("-1h")).toThrow();
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(5400000)).toBe("1h 30m");
  });

  it("formats hours only", () => {
    expect(formatDuration(7200000)).toBe("2h 0m");
  });

  it("formats minutes only", () => {
    expect(formatDuration(2700000)).toBe("0h 45m");
  });

  it("formats seconds for short durations", () => {
    expect(formatDuration(30000)).toBe("0h 0m");
  });
});
