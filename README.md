# Lazydata

Shared, read-only dataset validation and an early local Dataset Steward rebuild.
The [SvelteKit app](apps/web/README.md) lists datasets with shared metadata-check
statuses and opens README first. Metadata has local-only Name, Title and
Description inputs prefilled from the descriptor, required-field errors, section
navigation, disabled Save/Reset and working Reload. Name/Title share a responsive
row; Description sits below, followed by optional SemVer Version and a Created
date input. Changed dates serialize to RFC3339 at browser-local midnight.
Keywords adds Tasks/Projects tags on one row and a
policy-backed Stage dropdown/optional Extra keywords tags on the next. Tasks,
Projects and Stage are required. Resources adds local rows with path/name/format
defaults, root-path suggestions and read-only CSV/TSV/JSON/JSONL or recursive file
counts. Resource requirements follow shared policy (currently Name, Title, Path).
Sources adds local rows with required Title and URL or Path fields. The locator
must be a fully qualified HTTP(S) address or a safe relative POSIX path; URLs are
not fetched. Licenses uses a local name-only tag field with common SPDX
suggestions and custom identifiers allowed. Contributors adds local Name and
Roles rows, with role tags, suggestions and custom roles. Read-only checks and the
separate raw datapackage.json view remain. Checks revalidate unsaved edits after a
500 ms pause, without file reads or auto-save. Saving and dataset creation are not implemented.

## Use the validator

See the [validator README](packages/validator/README.md) for installation, CLI
usage and APIs. Template, Steward and portal adoption are separate changes.

## Development

Use Node.js 24 LTS and pnpm 12.x. From this directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm test
pnpm audit --audit-level=high
```

`pnpm typecheck` checks source and tests; Node runs the TypeScript tests directly.
No separate linter. Use `pnpm pack:validator` to build a local archive.

## CI and releases

[Validate lazydata](.github/workflows/validate-lazydata.yml) runs validator
checks, Steward checks/build/HTTP tests and audit on PRs, main pushes
and manual dispatch. Its check is `tests`.

[Release Please](.github/workflows/release.yml) runs after successful CI on current
main. Review and validate its release PR before merging. A release then triggers
[archive publishing](.github/workflows/publish-validator.yml): build the tagged
code, test installation, and attach a semver `.tgz` without overwriting assets.
A release is source-only until that upload succeeds. There is no registry
publication or standalone checksum file.

See the [release guide](docs/reference.md#releases) for versioning and retries,
and [architecture](docs/architecture.md) for validation boundaries.
