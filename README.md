# Penjaga

Penjaga provides shared dataset validation and a local Dataset Steward. The
[validator](packages/validator/README.md) checks metadata and repositories without
writing files. The [Steward app](apps/web/README.md) lists datasets, renders their
READMEs and lets you edit, preview and save metadata locally. Save regenerates the
README when metadata checks pass, keeping human notes and existing resource
counts. Direct JSON editing and dataset creation are not implemented.

## Rename status

The repository and current source use Penjaga. The package names are now
`@penjaga/validator` and `@penjaga/steward`; the CLI is `penjaga-validate`.
These renamed packages have not been released yet. Existing published archives
and consumer pins keep their original package/CLI names until a separately
approved release and migration.

## Development

Use Node.js 24 LTS and pnpm 12.x. From this directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm lint
pnpm typecheck
pnpm test
pnpm audit --audit-level=high
```

`pnpm lint` checks Steward only. The validator uses its own TypeScript 7
source/test checks; lint currently excludes it. CI runs typecheck, tests, app
checks and tests, and a high-severity dependency audit. See the [Steward app
notes](apps/web/README.md#checks) for the unresolved moderate dependency advisory.

Use `pnpm pack:validator` to build a local package archive.

## CI and releases

[Validate lazydata](.github/workflows/validate-lazydata.yml) runs the checks on
pull requests, pushes to `main` and manual dispatch. Its required check is
`tests`. The legacy workflow name/file stays unchanged to preserve release gating;
new code and user-facing branding use Penjaga.

[Release Please](.github/workflows/release.yml) manages versions and changelog
updates after successful CI on current `main`. Review its release PR before
merging. The publisher then builds and tests a compiled semver `.tgz` archive.
Packages are not published to a registry; existing release assets are never
overwritten. See the [release reference](docs/reference.md#releases).

See [architecture](docs/architecture.md) for package and app boundaries.
