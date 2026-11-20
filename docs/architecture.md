# Architecture

## Package boundaries

```text
Portable consumers ──> @lazydata/validator
                        metadata / policy / stages / bucket parser

Node tools ───────────> @lazydata/validator/repository
                        portable checks + bundled policy + filesystem checks

CLI ─────────────────> repository adapter
Steward checks ──────> portable metadata checks
Steward resource UI ─> separate bounded read-only counter
```

The validator owns shared rules and matched policy. Portable APIs perform no I/O
and accept untrusted values. The Node adapter loads the package's bundled policy
and checks referenced paths and optional root buckets. Neither entry point
modifies files, runs dataset code, counts resources or establishes publication
authority. API details and release procedures are in the
[validator reference](reference.md).

## Steward data flow

The SvelteKit app runs locally against an explicit `DATASET_ROOT` parent. Server
loads discover immediate `ds-*` directories. The dashboard returns folder names,
metadata status and allowlisted summary values, not descriptor text or paths.
Dataset detail defaults to README; Metadata and `datapackage.json` are separate
views. The reader accepts only discovered datasets and the fixed filenames
`README.md` and `datapackage.json`.

README Markdown is parsed on the server into an allowlisted tree. Svelte renders
escaped text and elements; raw HTML and images are disabled, and only credential-
free HTTPS links are clickable. Reviewed template fingerprints identify exact
README matches only; they do not establish provenance.

Metadata checks use the portable validator and matched policy. They do not read
resource files or infer, migrate or normalize metadata. The Metadata form edits
one page-scoped working object; the JSON preview and checks use its
`JSON.stringify` output. Unknown properties and metadata on surviving rows are
preserved. Strict admission rejects malformed or duplicate-key JSON and unsafe
number conversions. Formatting and equivalent number notation may normalize.

After Metadata has opened, shallow Metadata/JSON navigation retains the form,
draft and loaded revision. Failed or pending inputs remain visible and do not
silently replace the last representable JSON. A direct JSON visit shows saved
text until Metadata is opened. Save and Reset are disabled. There is no writer,
POST save action, direct JSON editor or dataset creation; the app does not write
dataset files.

## Filesystem boundaries

README and descriptor reads require discovered directory names and fixed
filenames. The reader uses bounded UTF-8 reads, no-follow opens, regular
single-link files and identity checks. These checks detect ordinary races but
are not a sandbox against hostile concurrent filesystem changes.

Resource path suggestions list safe root entries without reading their contents.
A separate GET endpoint counts a selected resource on demand. It refuses unsafe
paths, links and special files, and returns totals/status only. CSV/TSV, JSON,
JSONL and directory counts have byte, entry, depth, concurrency and time limits.
Counts are display-only and never enter metadata or shared validation. See the
[Steward README](../apps/web/README.md) for local usage and checks.

## Build and verification

The app imports compiled public exports from the workspace validator. App
`dev`, `build` and `check` compile the validator first. The app's browser bundle
and VM probe check portable draft code; they are not interactive browser tests.
Tests use synthetic temporary datasets and check that read-only routes do not
change files. CI runs validator checks/tests and Steward checks/tests. ESLint is
available locally with `pnpm lint` but is not a CI step.
