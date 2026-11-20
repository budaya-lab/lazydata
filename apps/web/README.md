# Local Dataset Steward

A local, read-only SvelteKit app for datasets under `DATASET_ROOT`. It discovers
immediate `ds-*` directories, shows metadata status, and opens each dataset's
README by default. Directories without a descriptor remain visible. The dashboard
supports search and metadata-status filters.

## Views

- **README** renders Markdown as escaped text and allowlisted elements. Embedded
  HTML and images are disabled. Only credential-free HTTPS links are clickable.
  Exact matches to reviewed template README fingerprints are labelled; this does
  not prove dataset origin or quality.
- **Metadata** provides local form controls for Overview, Keywords, Resources,
  Sources, Licenses and Contributors, plus shared metadata checks. Edits update
  one in-memory object. They appear in the read-only `datapackage.json` preview
  after Metadata is opened and survive switching between the views. Save and
  Reset remain disabled; direct JSON editing and dataset creation are not
  implemented.
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
reduce risk but do not sandbox hostile concurrent filesystem changes. The app
never writes dataset files.

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
