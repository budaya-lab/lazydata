# Local Dataset Steward

An early Svelte 5/SvelteKit app. It lists immediate, non-symlink `ds-*` directories
under an explicitly supplied parent folder, including folders without metadata.
Select a dataset to open its rendered `README.md`. Use **Metadata** to view
supplied metadata, shared validation and escaped `datapackage.json` text, even
if its JSON is malformed. Both viewers accept regular single-link UTF-8 files up
to 5 MiB, not symlinks or hard links. It does not edit/migrate files, read
resource files or buckets, count resources or generate READMEs. Metadata checks
are not full repository validation or publication approval. The Python Steward
remains the editing tool.

## Dataset table

Home opens directly to the dataset table in a dashboard-01-based shadcn-svelte
shell, using the Sera/taupe theme and self-hosted Noto Sans/Playfair fonts. Sidebar
links show all datasets, metadata issues or unavailable descriptors. The four
counts describe all discovered datasets, even when the table is filtered.

Search folder names and supplied titles, tasks, projects, stages or creators;
combine search with a metadata-status filter and select **Apply**. Search is
literal and case-insensitive, limited to 200 characters. Filters use normal GET
URLs and full-page navigation, so they also work without browser JavaScript.
**Clear filters** resets the view; **Refresh** rechecks while keeping its filters.
Missing values say **Not supplied**. Unreadable/unparseable summaries say
**Unavailable**, not invented metadata. No raw descriptors or resource paths are
returned in list data. Dataset links still open the read-only detail view.

## README view

README is the default dataset view. It works independently of `datapackage.json`.
Missing, unreadable or unsafe README files show **README unavailable**, without
hiding Metadata. Empty files are identified explicitly. Unknown datasets are 404.

**Template README** means an exact byte match against reviewed tpl-dataset README
fingerprints: releases v0.1.0 through v2.0.0 and pinned commit `0706c40`. No runtime
checkout or network is needed. Edited text, whitespace, line-ending or BOM changes
do not match. A nonmatch does not prove documentation quality or publication
permission. The flag does not infer the dataset's origin or version.

Markdown parses on the server into an allowlisted tree. Svelte renders its text
normally; no raw HTML injection, script/highlighter/Mermaid execution or image
loading occurs. Images show their alt text. Only credential-free HTTPS links are
clickable, with noreferrer/noopener; relative/local links are text, not resource
mappings. Markdown headings start below the dataset page heading. No files change.

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
individual dataset. Refresh to discover changes; select a name to open its README,
then select Metadata for its descriptor and metadata checks. Use the **Datasets** breadcrumb in the header to return to the
collection. The list shows metadata checks passed,
metadata issues (with count), or metadata unavailable beside each dataset. Missing
or unreadable descriptors do not hide other datasets. Refresh rechecks statuses.
Only metadata is checked, not resource files or buckets. Pages use server-rendered
semantic HTML with shadcn-svelte styling and hydrated sidebar controls. Dataset
filesystem access stays server-only; there is no client-side metadata editing.

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
The validator is linked internally. The UI uses the approved shadcn-svelte
components, bits-ui/date helpers and existing Tailwind/Lucide setup. Server-only
markdown-it 15 includes its own types. Lifecycle
scripts remain disabled during installation. New sidebar defaults use CSS classes
instead of inline width styles, preserving the production CSP without unsafe
inline styles/scripts. Development CSS injection uses SvelteKit's own CSP handling.
