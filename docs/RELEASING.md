# Releasing timereport-cli

`package.json` is the source of truth for the version. Releases use Semantic
Versioning and tags in the form `v<major>.<minor>.<patch>`.

## Before the first release

The npm name `timereport-cli` is currently unpublished. Claim it with the first
npm publication before advertising the npm installation command. Enable
two-factor authentication on the publishing npm account first.

## First release (`v0.1.0`)

1. Confirm `main` is clean and CI is green.
2. Run `npm run release:check`.
3. Create and push the existing version tag:

   ```bash
   git tag -a v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   ```

The release workflow verifies that the tag, package, lockfile, and CLI version
match. It then creates the GitHub release with generated notes, an npm tarball,
and a SHA-256 checksum. An existing release is never overwritten.

## Later releases

Choose the smallest compatible SemVer increment:

```bash
npm run release:patch  # backwards-compatible fix
npm run release:minor  # backwards-compatible feature
npm run release:major  # breaking change
git push origin main --follow-tags
```

`npm version` runs the full release check before changing `package.json` and
`package-lock.json`, committing the version, and creating the Git tag.

## First npm publication

An npm trusted publisher cannot be configured until the package exists. For the
initial publication, sign in to npm, download the exact tarball produced by the
tag workflow, verify it, and publish that immutable artifact:

```bash
bash -euo pipefail <<'RELEASE'
release_dir=$(mktemp -d)
trap 'rm -rf -- "$release_dir"' EXIT
npm whoami
gh release download v0.1.0 \
  --dir "$release_dir" \
  --pattern 'timereport-cli-0.1.0.tgz*'
gh release verify v0.1.0
gh release verify-asset v0.1.0 \
  "$release_dir/timereport-cli-0.1.0.tgz"
(
  cd "$release_dir"
  shasum -a 256 -c timereport-cli-0.1.0.tgz.sha256
)
npm run verify:package-archive -- \
  "$release_dir/timereport-cli-0.1.0.tgz"
npm publish "$release_dir/timereport-cli-0.1.0.tgz" \
  --access public \
  --ignore-scripts
RELEASE
```

Confirm that `https://www.npmjs.com/package/timereport-cli` shows version
`0.1.0`. Then add the trusted publisher in the package settings on npm:

- Provider: GitHub Actions
- Organization or user: `mares29`
- Repository: `timereport-cli`
- Workflow filename: `release.yml`
- Environment: `npm`
- Allowed action: `npm publish`

Create a GitHub environment named `npm` and require manual approval for it.
Do not add an `NPM_TOKEN` secret. The workflow uses short-lived OIDC credentials
and npm adds provenance automatically. Finally, create the repository Actions
variable `NPM_TRUSTED_PUBLISHING_ENABLED` with the value `true`.

## Later npm publications

The tag workflow creates the GitHub release and then runs its gated npm publish
job. It verifies that the release is immutable, verifies the release asset and
its checksum and package metadata, rejects an already published version, and
then publishes through the trusted publisher. The `npm` environment approval
remains the final human gate.

Before `NPM_TRUSTED_PUBLISHING_ENABLED=true` exists, tag workflows safely skip
the npm job. This prevents the first GitHub release from attempting OIDC before
the npm package and trusted-publisher relationship exist.

Stable versions use the npm `latest` dist-tag. Prerelease versions use `next`.

Published versions cannot be reused. Verify the package name, version, and
artifact contents before running this command.

Protect `v*` tags and enable immutable releases in the GitHub repository
settings before the first public release.
