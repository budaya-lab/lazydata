# Lazydata

Shared, read-only dataset validation. A TypeScript/SvelteKit rebuild of Dataset
Steward is planned; the web application is not implemented yet.

## Use the validator

See the [validator README](packages/validator/README.md) for installation, CLI
usage and APIs. Template, Steward and portal adoption are separate changes.

## Development

Use Node.js 24 LTS and pnpm 12.11.2. From this directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm test
pnpm audit --audit-level=high
```

`pnpm typecheck` checks source and tests; Node runs the TypeScript tests directly.
No separate linter. Use `pnpm pack:validator` to build a local archive.

## CI and releases

[Validate lazydata](.github/workflows/validate-lazydata.yml) runs typecheck,
tests/build and audit on PRs, main pushes and manual dispatch. Its check is `tests`.

[Release Please](.github/workflows/release.yml) runs after successful CI on current
main. Review and validate its release PR before merging. A release then triggers
[archive publishing](.github/workflows/publish-validator.yml): build the tagged
code, test installation, and attach a semver `.tgz` without overwriting assets.
A release is source-only until that upload succeeds. There is no registry
publication or standalone checksum file.

See the [release guide](docs/reference.md#releases) for versioning and retries,
and [architecture](docs/architecture.md) for validation boundaries.
