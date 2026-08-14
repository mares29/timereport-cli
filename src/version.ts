import { createRequire } from "node:module";

interface PackageManifest {
  version?: unknown;
}

const require = createRequire(import.meta.url);
const manifest = require("../package.json") as PackageManifest;

if (typeof manifest.version !== "string") {
  throw new Error("Missing package version");
}

export const VERSION = manifest.version;
