# Lazydata

A fresh TypeScript project for a future SvelteKit dataset workbench.
Only the shared validator is implemented in this first slice; there is no web
application yet. The previous Lazydata experiment is not part of this project.

## Layout

- `packages/validator/`: portable validation, bundled policy, Node adapter and CLI.
- `apps/web/`: reserved for the future SvelteKit application; not scaffolded yet.

The application and external consumers use the same validator package. Validation
never edits metadata or files. Discovery, counting and reviewed writes belong to
application code, not this package.

## Development

Use Node.js 22+ and pnpm 12.11.2. From this directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm typecheck
pnpm test
pnpm audit --audit-level=high
```

Tests use Node's built-in test runner and fictional temporary datasets.
No separate lint tool is configured. Strict compiler checks reject unused code.

See the [validator API](packages/validator/README.md) and
[architecture](docs/architecture.md). Packages are private and unreleased.
Template, Steward and portal integration are separate migration steps.

## CI and releases

[Validate lazydata](.github/workflows/validate-lazydata.yml) runs on PRs targeting
`main`, pushes to `main` and manual dispatch. It uses Node.js 22 and the pinned
pnpm version, installs frozen dependencies without lifecycle scripts, then runs
typecheck, tests (including build and packed-consumer checks) and dependency audit.
Keep workflow **Validate lazydata** and job/check **tests** stable.

[Release Please](.github/workflows/release.yml) follows the portal/Steward pattern:
only successful validation of a push to this repository's current `main` can
open or update a release PR. It rechecks the current main SHA before acting.
The action uses the same pinned revision and built-in `GITHUB_TOKEN`; no PAT or
registry secret is needed.

Use Conventional Commit squash titles: `feat: ...` for minor releases,
`fix: ...` for patches and `feat!: ...` or a `BREAKING CHANGE:` footer for major
releases. Docs/chore-only commits normally do not trigger a release.

One repository-wide release starts at `v0.1.0`. Release Please updates the root
`package.json`, validator package version, root `CHANGELOG.md` and release manifest
in one reviewed PR. The validator version uses the
[JSON extra-file updater](https://github.com/googleapis/release-please/blob/v17.3.0/docs/customizing.md#updating-arbitrary-json-files).
Do not edit release-managed versions, manifest or changelog manually. The current
pnpm lockfile has dependency resolutions, not project versions; no lockfile
updater or workspace-release plugin is needed.

Before merging a release PR, review its diff and manually dispatch **Validate
lazydata on that PR's branch**. Rerun after updates. PRs created with the built-in
token do not trigger automatic PR CI; see the
[Release Please token guidance](https://github.com/googleapis/release-please-action/tree/5c625bfb5d1ff62eadeeb3772007f7f66fdcf071#other-actions-on-release-please-prs).
Merge only with owner approval and passing required checks. Merging the release
PR creates the version tag and GitHub Release, not an npm publication or compiled
archive upload. Both packages stay private. Dataset-consumer distribution remains
separate work.

Before enabling releases, the owner must require reviewed PRs and the **tests**
check on `main`, restrict direct pushes after bootstrap, and allow Actions to
create PRs if repository policy requires it. This setup does not change GitHub
settings, publish a release or deploy an application.
