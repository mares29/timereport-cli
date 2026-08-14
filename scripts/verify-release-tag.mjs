import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tag = process.argv[2];
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
const version = manifest.version;
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

if (typeof tag !== "string" || tag.length === 0) {
  throw new Error("Usage: npm run verify:release-tag -- v<version>");
}

if (typeof version !== "string" || !semverPattern.test(version)) {
  throw new Error(`package.json contains invalid SemVer: ${String(version)}`);
}

if (tag !== `v${version}`) {
  throw new Error(`Tag ${tag} does not match package version v${version}`);
}

if (lockfile.version !== version || lockfile.packages?.[""]?.version !== version) {
  throw new Error("package-lock.json version does not match package.json");
}

const cliVersion = execFileSync(process.execPath, ["dist/index.js", "--version"], {
  encoding: "utf8",
}).trim();

if (cliVersion !== version) {
  throw new Error(`CLI reports ${cliVersion}, expected ${version}`);
}

console.log(`Verified release ${tag}`);
