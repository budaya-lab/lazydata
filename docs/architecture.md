# Architecture

## Package boundaries

```text
Portable consumers ──> @penjaga/validator
                        metadata / policy / stages / bucket parser

Node tools ───────────> @penjaga/validator/repository
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
free HTTPS links are clickable. Recognized task/project/stage/version Shields image tokens
become escaped local Badge components; no image URL is sent to the client or
fetched. Other image tokens remain alt text. Reviewed template fingerprints identify exact
README matches only; they do not establish provenance.

Metadata checks use the portable validator and matched policy. They do not read
resource files or infer, migrate or normalize metadata. The Metadata form edits
one page-scoped working object; the JSON preview and checks use its
`JSON.stringify` output. Unknown properties and metadata on surviving rows are
preserved. Strict admission rejects malformed or duplicate-key JSON and unsafe
number conversions. Formatting and equivalent number notation may normalize.

After Metadata has opened, shallow Metadata/JSON navigation retains the form,
draft and loaded revision. README tab navigation uses `goto` with `refreshAll`
to re-run server loads even when returning from a shallow URL to the underlying
README route. It keeps the dataset-scoped draft and does not reload the document. Failed or pending inputs remain visible and do not
silently replace the last representable JSON. A direct JSON visit shows saved
text until Metadata is opened. Reset remains disabled. Direct JSON editing and
dataset creation are not implemented.

Explicit Save posts the serialized document as UTF-8 `application/json` to
`/datasets/[name]/save`. The server bounds the body to 5 MiB, repeats strict
admission and shared metadata checks, then replaces only the discovered dataset's
existing regular descriptor using an exclusive same-directory temporary file,
file sync and atomic rename. Policy issues are reported but do not block saving
incomplete work. No resource contents are read. Success advances the browser's
saved baseline without replacing newer edits or row identities; failure retains
the draft. This single-user version assumes no external changes and has no
revision/conflict protocol. Basic mode and ownership survive; ACLs and extended
attributes do not.

After descriptor Save, passing metadata checks trigger an app-only README
renderer/writer. It uses the saved object, existing resource counts and optional
`buckets.csv` through the shared `parseBuckets` API. It never counts resources or
changes the descriptor/buckets. The same bounded reader admits this additional
fixed filename with a 1 MB limit. README generation preserves notes after
`<!-- notes -->`, keeps unmarked handwritten text and discards only exact
reviewed templates. It caps output at 5 MiB and atomically replaces changed
README bytes using the same writer as the descriptor. A README failure returns a
separate warning with metadata Save success. The writes are not a two-file
transaction. Generated READMEs start with title, name/Created-date subtitle,
badges and escaped description paragraphs. Contributors/sources use lists;
resources/buckets keep comparison tables. Version joins the badge row when
supplied. The viewer suppresses Penjaga's known bookkeeping markers (and the legacy generated header) and
honors Markdown's hidden tight-list paragraph tokens. Portable validation remains read-only. See
[Save usage](../apps/web/README.md#save).

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
Tests use synthetic temporary datasets. Read-only routes leave files unchanged;
Save tests cover exact descriptor replacement, refused input, README generation,
note preservation, optional bucket handling and pre-rename failure cleanup.
CI runs validator checks/tests and Steward checks/tests. ESLint is available
locally with `pnpm lint` but is not a CI step.
