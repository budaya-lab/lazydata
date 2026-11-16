# Local Dataset Steward

An early Svelte 5/SvelteKit app. It lists immediate, non-symlink `ds-*` directories
under an explicitly supplied parent folder, including folders without metadata.
Select a dataset to view its `datapackage.json` as escaped, read-only text, even
if its JSON is malformed. The viewer accepts regular single-link UTF-8 files up
to 5 MiB, not symlinks or hard links. It shows supplied metadata and shared
Lazydata metadata-validation results. It does not edit/migrate files, read
resource files or buckets, count resources or generate READMEs. Metadata checks
are not full repository validation or publication approval. The Python Steward
remains the editing tool.

## Metadata summary

The summary shows supplied name, title, description, version, created, licences,
keywords and contributors. Creators are only contributors whose `roles` contain
`creator`. Task, project and stage come from their explicit keyword prefixes.
Missing values say **Not supplied**; conflicting/unknown values remain visible
with validation issues. Nothing is inferred from names, folders, Git or the OS.
Legacy top-level creator/task/project/stage fields are not silently mapped to the
new contract; the original descriptor remains visible below the summary.
Malformed JSON shows its raw text and a generic parse issue. Other malformed
values stay visible as literal text. Metadata and diagnostics are never HTML or
automatically followed links. No dataset-local configuration weakens the policy.

## Run

Use Node.js 24+ and pnpm 12.x. From the `lazydata/` workspace root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
DATASET_ROOT="/absolute/path/to/datasets" pnpm --filter @lazydata/steward dev
```

Open the loopback URL printed in the terminal. Supply the **parent**, not an
individual dataset. Refresh to discover changes; select a name to open its
descriptor and use the back link to return. The list shows metadata checks passed,
metadata issues (with count), or metadata unavailable beside each dataset. Missing
or unreadable descriptors do not hide other datasets. Refresh rechecks statuses.
Only metadata is checked, not resource files or buckets. Pages use server-rendered
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
Do not expose or reverse-proxy this local tool onto a network. These path checks
are not an OS sandbox against a process concurrently replacing filesystem
ancestors. Future editing needs separate write/conflict safeguards.

## Check

```sh
pnpm --filter @lazydata/steward check
pnpm --filter @lazydata/steward test
```

`check` runs Svelte/accessibility diagnostics and strict app/test typechecking.
`test` builds the app, then runs native Node TypeScript filesystem/HTTP tests
against temporary fixtures in dev and built modes. There is no separate linter.
The app uses TypeScript 6 for framework compatibility; the validator stays on 7.
App `dev`, `check` and `build` explicitly compile the workspace validator first,
using its public package exports and matched policy. No install hooks are needed.
Only the existing validator is linked; no extra third-party libraries were added.
