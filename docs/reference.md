# Validator and release reference

## Validation

### API contract

Inputs are `unknown` until runtime checks succeed. Policy types are readonly;
exports include `DatasetPolicy`, `PackageField`, `ResourceField`, `BucketRow`
and `Buckets`. Portable checks have no I/O or Node globals.

- `validatePolicy` returns policy errors. Metadata/stage functions throw for
  invalid policy; the bucket parser throws for invalid CSV or encoding.
- Stage helpers permit absent stages for catalogue display. Full metadata
  validation requires the configured task, project and stage keywords.
- The Node adapter loads policy from its installed package on each call. It
  checks referenced paths, realpath containment, resource types and root buckets.
  Descriptor/filesystem issues return errors; bundled-policy failures throw.
- Importing an API does not start the CLI. CLI descriptor read/parse errors omit
  local absolute paths and descriptor contents.

Validation never normalizes, repairs, counts, writes, generates READMEs or runs
dataset-local scripts. It is not a sandbox against concurrent filesystem changes
or authority to read or publish data. It does not establish full Data Package
conformance, data quality, confidentiality or licensing authority.

The JSON import example in the package README targets Node.js 24. Browser and
SvelteKit integration have not been implemented or verified.

### Bundled policy

[`dataset.config.json`](../packages/validator/dataset.config.json) declares schema
version 1, stages, required fields, keyword rules and optional bucket presence.
Unknown keys and unsupported requirements fail validation.

- Packages require name, title, description, keywords and nonempty resources.
- Resources require unique names, titles and safe relative paths.
- Keywords require exactly one nonblank `task:`, `project:` and controlled `stage:`
  value. Other nonblank keywords are allowed.
- Provenance, counts and buckets are optional; supplied values are validated,
  never invented. Directory resources omit `format`. `count` is a non-negative
  safe integer for items, separate from `bytes`.
- Root `buckets.csv`, when present, has exactly a label column followed by `count`,
  unique nonblank labels, safe non-negative integer counts and at least one row.
  It must be a regular, non-symlink file with valid UTF-8 and strict CSV quoting,
  at most 1,000,000 bytes. Declaring it as a resource is optional.

Policy cannot disable path containment, count range checks or bucket limits.

### Tests and adoption

Authored tests, release checks and VM fixtures are TypeScript. Node runs them
using [native type stripping](https://nodejs.org/docs/latest-v24.x/api/typescript.html#type-stripping);
`pnpm typecheck` builds the package and checks source and tests separately.
Generated JavaScript consumers and the dataset-script trap remain JavaScript.

Tests use fictional temporary datasets, frozen inputs, filesystem snapshots,
a portable VM, CLI failures and isolated consumers. Consumer declarations compile
without Node ambient types; the CLI also runs through a symlink. The install test
uses a loopback URL and fresh pnpm store, then checks a frozen offline reinstall,
API imports and CLI use without a compiler or registry. To test a prebuilt
archive, set both `VALIDATOR_ARCHIVE` and `VALIDATOR_VERSION`.

The suite needs pnpm and `tar`. CI targets Node.js 24 LTS.
Real-browser verification is separate. Adoption must replace common checks rather
than introduce competing rules. Keep current consumers working until an approved
cutover; do not copy source, fetch moving branches or use sibling checkouts.

## Releases

### Review and merge

1. Use Conventional Commit squash titles: `feat: ...` for minor releases,
   `fix: ...` for patches, and `feat!: ...` or a `BREAKING CHANGE:` footer for
   major releases. Docs/chore-only changes normally do not trigger releases.
2. Release Please runs only after successful validation of a same-repository push
   to current main, rechecking its SHA. It uses a pinned action and built-in
   `GITHUB_TOKEN`; no PAT or registry secret is needed.
3. One repository release updates root and validator versions, the changelog and
   release manifest. The validator uses the
   [JSON extra-file updater](https://github.com/googleapis/release-please/blob/v17.3.0/docs/customizing.md#updating-arbitrary-json-files).
   Do not edit these values manually. The pnpm lockfile has no project versions
   needing a release updater.
4. Review the release PR and manually dispatch **Validate lazydata on its branch**;
   rerun after updates. Built-in-token PRs may not trigger automatic CI; see
   [Release Please guidance](https://github.com/googleapis/release-please-action/tree/5c625bfb5d1ff62eadeeb3772007f7f66fdcf071#other-actions-on-release-please-prs).
   Merge only with owner approval and passing required checks.

Owners must enforce reviewed PRs and the `tests` check on main, restrict direct
pushes and permit Actions to create PRs. Workflows do not configure those settings.
Keep workflow **Validate lazydata** and check **tests** stable.

### Publish or retry an archive

A new release calls [Publish validator archive](../.github/workflows/publish-validator.yml).
It verifies the published stable semver tag belongs to main history and matches
root/package/manifest versions. It builds, tests and audits tagged code, packs
compiled JavaScript, declarations and policy, then tests the exact archive before
uploading `lazydata-validator-VERSION.tgz`. Packages remain private; there is no
registry publication, consumer build step or standalone checksum file. Pin the
exact release URL and keep normal package manager lockfile integrity enabled.

For an older source-only release or a failed upload, manually dispatch the
publisher **on main**, supplying its existing `vMAJOR.MINOR.PATCH` tag. Existing
assets are never replaced. A tag has no installable archive until upload succeeds;
GitHub's generated source archives are not substitutes. Publishing a release does
not migrate dataset repositories or add portal catalogue records.
