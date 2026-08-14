const candidate = parseVersion(process.argv[2]);
const current = parseVersion(process.argv[3]);

if (compareVersions(candidate, current) <= 0) {
  throw new Error(
    `Version ${candidate.raw} must be newer than current dist-tag version ${current.raw}`,
  );
}

console.log(`Verified ${candidate.raw} is newer than ${current.raw}`);

function parseVersion(value) {
  if (typeof value !== "string") {
    throw new Error("Usage: verify-version-order.mjs <candidate> <current>");
  }

  const match = value.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  );
  if (!match) {
    throw new Error(`Invalid SemVer: ${value}`);
  }

  const prerelease = match[4]?.split(".") ?? [];
  for (const identifier of prerelease) {
    if (/^\d+$/.test(identifier) && identifier.length > 1 && identifier[0] === "0") {
      throw new Error(`Invalid numeric prerelease identifier: ${identifier}`);
    }
  }

  return {
    raw: value,
    core: [match[1], match[2], match[3]],
    prerelease,
  };
}

function compareVersions(left, right) {
  for (let index = 0; index < left.core.length; index += 1) {
    const result = compareNumeric(left.core[index], right.core[index]);
    if (result !== 0) return result;
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;

    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) {
      return compareNumeric(leftIdentifier, rightIdentifier);
    }
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }

  return 0;
}

function compareNumeric(left, right) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
