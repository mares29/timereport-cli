import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const archivePath = process.argv[2];

if (typeof archivePath !== "string" || archivePath.length === 0) {
  throw new Error(
    "Usage: npm run verify:package-archive -- <package-archive.tgz>",
  );
}

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const expectedFilename = `${manifest.name}-${manifest.version}.tgz`;

if (basename(archivePath) !== expectedFilename) {
  throw new Error(
    `Archive ${basename(archivePath)} does not match ${expectedFilename}`,
  );
}

const packedManifest = JSON.parse(
  execFileSync("tar", ["-xOf", archivePath, "package/package.json"], {
    encoding: "utf8",
  }),
);

const expectedFields = {
  name: manifest.name,
  version: manifest.version,
  repository: manifest.repository,
  bin: manifest.bin,
  engines: manifest.engines,
  license: manifest.license,
  publishConfig: manifest.publishConfig,
};

for (const [field, expected] of Object.entries(expectedFields)) {
  const actual = packedManifest[field];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Packed package.json field ${field} does not match the repository manifest`,
    );
  }
}

console.log(`Verified npm archive ${expectedFilename}`);
