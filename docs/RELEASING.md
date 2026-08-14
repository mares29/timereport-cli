# Releasing timereport-cli

`package.json` is the source of truth for the version. Releases use Semantic
Versioning and tags in the form `v<major>.<minor>.<patch>`.

## Release requirements

- CI on `main` is green.
- GitHub immutable releases are enabled.
- The `npm` GitHub environment requires approval.
- npm trusts `release.yml` for `mares29/timereport-cli` with environment `npm`.
- Repository variable `NPM_TRUSTED_PUBLISHING_ENABLED` is `true`.
- No long-lived `NPM_TOKEN` secret exists.

## Create a release

1. Confirm `main` is clean and CI is green.
2. Run `npm run release:check`.
3. Choose the smallest compatible SemVer increment:

   ```bash
   npm run release:patch  # backwards-compatible fix
   npm run release:minor  # backwards-compatible feature
   npm run release:major  # breaking change
   ```

4. Push the version commit and tag:

   ```bash
   git push origin main --follow-tags
   ```

`npm version` runs the full release check before changing `package.json` and
`package-lock.json`, committing the version, and creating the Git tag.

## Automated publication

The tag workflow creates the GitHub release and then runs its gated npm publish
job. It verifies that the release is immutable, verifies the release asset and
its checksum and package metadata, rejects an already published version, and
then publishes through the trusted publisher. The `npm` environment approval
remains the final human gate.

Stable versions use the npm `latest` dist-tag. Prerelease versions use `next`.

Published versions cannot be reused. Verify the package name, version, and
artifact contents before running this command.

The npm job uses short-lived OIDC credentials and receives provenance
automatically. Never add an `NPM_TOKEN` secret.
