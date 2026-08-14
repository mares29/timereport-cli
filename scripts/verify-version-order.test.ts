import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("./verify-version-order.mjs", import.meta.url),
);

function verify(candidate: string, current: string): void {
  execFileSync(process.execPath, [scriptPath, candidate, current], {
    stdio: "pipe",
  });
}

describe("verify-version-order", () => {
  it("accepts newer stable and prerelease versions", () => {
    expect(() => verify("0.1.1", "0.1.0")).not.toThrow();
    expect(() => verify("1.0.0-rc.10", "1.0.0-rc.2")).not.toThrow();
    expect(() => verify("1.0.0", "1.0.0-rc.1")).not.toThrow();
  });

  it("compares arbitrarily large numeric identifiers without precision loss", () => {
    expect(() =>
      verify("100000000000000000000.0.0", "99999999999999999999.0.0"),
    ).not.toThrow();
  });

  it("rejects older, equal, and build-only changes", () => {
    expect(() => verify("0.1.0", "0.2.0")).toThrow();
    expect(() => verify("1.0.0", "1.0.0")).toThrow();
    expect(() => verify("1.0.0+new", "1.0.0+old")).toThrow();
  });

  it("rejects invalid numeric prerelease identifiers", () => {
    expect(() => verify("1.0.0-01", "1.0.0-1")).toThrow();
  });
});
