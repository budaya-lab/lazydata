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
