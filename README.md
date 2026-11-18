# Lazydata

Shared, read-only dataset validation and an early local Dataset Steward rebuild.
The [SvelteKit app](apps/web/README.md) lists datasets with shared metadata-check
statuses and opens README first. Metadata has local-only Name, Title and
Description inputs prefilled from the descriptor, required-field errors, section
navigation, disabled Save/Reset and working Reload. Name/Title share a responsive
row; Description sits below. Read-only checks and the separate raw datapackage.json
view remain. Saving and dataset creation are not implemented.

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
