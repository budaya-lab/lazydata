# Local Dataset Steward

A local SvelteKit app for datasets under `DATASET_ROOT`. It discovers
immediate `ds-*` directories, shows metadata status, and opens each dataset's
README by default. Directories without a descriptor remain visible. The dashboard
supports search and metadata-status filters.

## Views

- **README** renders Markdown as escaped text and allowlisted elements. Embedded
  HTML and images are disabled. Only credential-free HTTPS links are clickable.
  Task/project/stage/version Shields badges render as local app badges, without fetching
  their images. Other images remain text-only.
  Exact matches to reviewed template README fingerprints are labelled; this does
  not prove dataset origin or quality. Opening the README tab requests fresh
  server data without a full-page reload, so saved changes appear immediately.
- **Metadata** provides local form controls for Overview, Keywords, Resources,
  Sources, Licenses and Contributors, plus shared metadata checks. Edits update
  one in-memory object. They appear in the read-only `datapackage.json` preview
  after Metadata is opened and survive switching between the views. **Save
  changes** writes the draft to the dataset's existing descriptor and generates
  its README when metadata checks pass. Reset remains
  disabled; direct JSON editing and dataset creation are not implemented.
- **datapackage.json** displays the saved JSON as escaped text unless Metadata
  has been opened in the current page session, in which case it previews the
  synchronized draft. Normal JSON serialization may change whitespace, escapes
  and number notation. Editing requires strict object JSON with unique keys and is
  bounded to 5 MiB, 128 levels and 100,000 values. Malformed documents and unsafe
  numbers remain viewable but cannot be edited.

Checks use the shared validator and re-run locally 500 ms after edits. They do not
read resource contents. Metadata policy remains authoritative; the form does not
repair or infer values. Unknown properties and metadata on surviving rows are
preserved. A failed or pending edit stays visible and is not silently represented
as saved data.

Overview requires Name, Title and Description. Version and Created are optional;
Created preserves its supplied timestamp until changed, then uses local midnight
for the selected date. Keywords provides Tasks, Projects, Stage and optional
extra tags. Sources accept a safe relative path or a fully qualified HTTP(S) URL;
URLs are never fetched. Licenses allow custom names with common SPDX suggestions.
Contributors map Name to Data Package `title` and support optional Roles.

Resources allow local row edits and safe root-path suggestions. Choosing a path
also fills and synchronizes its generated Name and Format, while preserving manual
overrides. Counts are separate, read-only snapshots: CSV/TSV data rows (excluding
the header), JSON array items, JSONL records or files in a directory. The path
extension selects the counter, even when Format is overridden. Unsupported formats
are marked “Not countable”; read and safety failures are not reported as zero.
Counts never enter the metadata draft.

## Save

Save sends the current JSON draft to one same-origin endpoint. The server repeats
strict JSON admission and shared metadata checks, then writes the exact text using
a same-directory temporary file and atomic rename. Metadata policy issues do not
block saving incomplete work; malformed or unsafe JSON does. Unrepresentable form
inputs block Save. Failed requests retain the draft; edits made during a save
remain unsaved until the next Save.

This first version assumes one user and no external file changes. There is no
revision/conflict detection: Save overwrites the descriptor currently on disk.
Basic file permissions and ownership are retained, but ACLs and extended
attributes are not preserved. After the descriptor is saved, passing metadata
checks trigger `README.md` generation. The README includes supplied metadata,
existing resource counts and optional `buckets.csv` (label plus `count`, at most
1 MB). Save never scans resources, recalculates counts or changes bucket files.
The generated layout is title, name/Created-date subtitle, badges (including
Version when supplied), then description paragraphs. Contributors and sources
use lists; only resources and buckets use tables. The subtitle shows the supplied
Created calendar date without timezone conversion; missing dates/versions are
omitted. The viewer hides Lazydata's generated header and notes delimiter, not
arbitrary HTML, and renders tight lists without extra paragraph wrappers.

Text below `<!-- notes -->` is kept exactly. An unmarked handwritten README is
moved below that marker; only exact reviewed template bytes are discarded.
Missing READMEs are created privately (mode `0600`). Existing READMEs require a
regular, single-link UTF-8 file, and retain basic permissions and ownership.
Generation is bounded to 5 MiB; identical output is not rewritten. Metadata issues
skip generation. Unreadable/invalid buckets or README write failures leave the
README untouched and show a warning without undoing a successful metadata Save.
The two files are replaced separately, not as one transaction.

## Run locally

Use Node.js 24+ and pnpm 12.x. Install from the `lazydata/` workspace root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
DATASET_ROOT="/absolute/path/to/datasets" pnpm --filter @lazydata/steward dev
```

`DATASET_ROOT` must name the parent directory, not a dataset. The development
server binds to loopback. For a built server:

```sh
pnpm --filter @lazydata/steward build
DATASET_ROOT="/absolute/path/to/datasets" pnpm --filter @lazydata/steward start
```

The start wrapper binds to `127.0.0.1` and uses port 3000 unless `PORT` is set.
Do not expose or reverse-proxy this local tool onto a network.

README and descriptor reads are limited to discovered datasets and the fixed
filenames (`README.md` and `datapackage.json`). They are bounded to 5 MiB and
require regular, single-link UTF-8 files. The separate resource counter reads only
safe selected paths and has byte, traversal, depth and time limits. These checks
reduce risk but do not sandbox hostile concurrent filesystem changes. Only an
explicit Save writes the descriptor and, when checks pass, its generated README.

## Checks

From the workspace root:

```sh
pnpm lint
pnpm --filter @lazydata/steward check
pnpm --filter @lazydata/steward test
```

Tests use temporary fixtures and exercise dev/build HTTP behavior. A Vite bundle
and VM probe checks that browser draft code has no Node built-ins; it is not an
interactive browser test. CI runs the app check and tests, but not ESLint.

The full dependency audit reports one owner-deferred moderate `minimatch`
advisory in the lint dependency graph
([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)). No
override or advisory ignore is configured. Recheck it during dependency updates
and before release; this is not release clearance.
