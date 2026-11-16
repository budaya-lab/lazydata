# Local Dataset Steward

An early Svelte 5/SvelteKit app. It lists immediate, non-symlink `ds-*` directories
under an explicitly supplied parent folder, including folders without metadata.
It does not read descriptors, edit files, validate datasets, count resources or
generate READMEs. The existing Python Steward remains the working editing tool.

## Run

Use Node.js 24+ and pnpm 12.x. From the `lazydata/` workspace root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
DATASET_ROOT="/absolute/path/to/datasets" pnpm --filter @lazydata/steward dev
```

Open the loopback URL printed in the terminal. Supply the **parent**, not an
individual dataset. Refresh to discover changes. The page uses server-rendered
semantic HTML with no styling or client-side editing.

For a built local server:

```sh
pnpm --filter @lazydata/steward build
DATASET_ROOT="/absolute/path/to/datasets" pnpm --filter @lazydata/steward start
```

The start command fixes the host to `127.0.0.1`, rejects `SOCKET_PATH` and uses
port 3000 unless `PORT` is supplied. Development also defaults to loopback.
Pass `DATASET_ROOT` through the process environment; no dataset path is built
into the app. Missing or unreadable configuration returns an error, not an empty
success. Detailed filesystem failures are logged only to the local terminal.
Do not expose or reverse-proxy this local tool onto a network.

## Check

```sh
pnpm --filter @lazydata/steward check
pnpm --filter @lazydata/steward test
```

`check` runs Svelte/accessibility diagnostics and strict app/test typechecking.
`test` builds the app, then runs native Node TypeScript filesystem/HTTP tests
against temporary fixtures in dev and built modes. There is no separate linter.
The app uses TypeScript 6 for framework compatibility; the validator stays on 7.
