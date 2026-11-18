# Local Dataset Steward

An early read-only Svelte 5/SvelteKit app. It lists immediate, non-symlink `ds-*`
directories under an explicitly supplied parent folder, including folders without
metadata. Select a dataset to open its rendered README. Metadata contains a form
Overview/Keywords/Resources/Sources UI and read-only checks; datapackage.json separately shows escaped raw
text, even when malformed. The form is being implemented one step at a time.
Required labels use `*`, explained above the fields. Optional labels are unmarked;
native/ARIA required states and validation are unchanged.

Overview loads Name, Title and Description from the current datapackage.json.
Name and Title share a row on wider screens; Description sits below. Only supplied
strings fill the controls; missing/non-string values stay blank without coercion.
Empty/whitespace-only inputs show inline required errors that clear when filled.
Input edits remain local. Reload rereads the descriptor. Shared Checks still
report the saved descriptor, not these local inputs.

Version and Created share a row below Description. Both are optional and start
blank when absent; no version or current date is invented. Version must be exact
SemVer (including optional prerelease/build identifiers) when filled. Invalid
supplied types remain blank with an error rather than being coerced.

Created uses a native date input. It initializes after browser hydration, never
from the server time zone. Existing timestamps display their browser-local date;
the original timestamp, time, offset and precision remain unchanged until edited.
Changing the date prepares `YYYY-MM-DDT00:00:00±HH:MM` using the browser's offset
at midnight on that selected date, including daylight-saving rules. The prepared
RFC3339 value is shown below the date input and stays local in the hidden
`created` control; it is not a file save. The preview keeps the original timestamp
until edited, matches the prepared value after edits and is hidden when invalid.
Clearing the date clears both the local value and its preview. Invalid dates, skipped midnights/days
and historical sub-minute offsets show an error instead of silently shifting time.
Without browser JavaScript, the date input remains disabled. No time/zone selector.

Keywords prefills Tasks from `task:`, Projects from `project:`, Stage from `stage:`
and Extra keywords from the remaining supplied strings. Tasks/Projects share one
responsive row; Stage/Extra keywords share the next. Tasks and Projects require a
nonblank tag; Stage requires a selection. Extra keywords are optional. Enter or
comma adds tags; leaving the input commits pending text. Spaces stay inside a tag,
including project names. Remove a tag with its labelled cross button. New tags
trim outer whitespace and avoid exact duplicates; supplied tags are not rewritten.
Stage options/labels come from the compiled validator's matched policy, never
from dataset-local configuration. Missing/unknown/multiple stages leave an empty
selection; the shared saved-metadata issues remain visible. Shared policy still
requires exactly one task and one project; local tag controls do not change it.

Resources contains local add/remove rows for Name, Path, Title, Format and a
read-only Count. Required markers follow the compiled shared policy: currently
Name, Title and Path. Draft resource checks reuse that validator; saved-descriptor
Shared Checks are separate. Supplied names/titles are retained. Missing Name
uses the basename without its final extension; missing Format uses the lowercase
extension. Path edits update defaults without replacing manual overrides. A
selected directory keeps its basename and has blank, disabled Format.

Path offers native autocomplete from safe root files/folders, excluding hidden,
linked and template/metadata entries. Nested relative paths can be typed. Native
suggestion appearance depends on the browser. Path arrays/malformed supplied
values stay blank and invalid with a raw-descriptor warning, not coerced text.

Counts run after browser mount, path blur or Recount, not during SSR/shared
validation. CSV/TSV excludes the header and counts logical records, including
quoted newlines; inconsistent columns/malformed quotes are errors. JSON supports
top-level arrays; JSONL counts valid nonblank records. Directory counts include
regular files recursively, including hidden files inside the selected folder.
Unsupported formats/JSON shapes say Unsupported. Read/parse/safety failures say
Unavailable, never zero or the descriptor's old count. Manual Format overrides
do not change the counter's path-extension-based parser. Counts are snapshots.

The counter reads at most 8 MiB per file, 10,000 directory entries, 32 directory
levels and 128 JSON levels, with a 5-second read/traversal budget. There are at
most two active counters; each form queues requests serially and ignores stale
results. The UI caps 200 rows and 1,000 suggestions. Limits/errors are visible.
It refuses traversal, URLs, hidden path segments, links and special files. Counts
return only totals/status, never source content. The GET endpoint stays local
and no-store; no POST/write endpoint was added.

Sources has local add/remove rows with required Title and URL or Path fields.
The locator must be a fully qualified HTTP(S) address or a safe relative POSIX
path. The form validates this syntax locally. It does not fetch URLs, read paths,
or alter saved-descriptor validation policy. Existing source values are retained
only as local prefill; unsupported types stay blank and invalid rather than being
coerced. Adding/removing/editing rows changes no files.

There is no save endpoint, writer, automatic Created date or dataset creation.
Save and Reset are disabled placeholders. The app never writes dataset files,
migrates metadata or generates READMEs. Shared validation does not read resource
contents or buckets; only this separate, bounded resource counter does reads. Checks do not authorize publication. The Python Steward remains unchanged.

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
returned in list data. Dataset links open the README view.

## README view

README is the default dataset view. It works independently of datapackage.json.
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

## Metadata form (local only)

Implement the form in `src/lib/components/metadata-form.svelte`. It retains:

- Section navigation and Overview's required Name/Title text inputs and Description
  textarea, optional Version/Created, Keywords and Resources controls above.
  Other section bodies are not implemented.
- Read-only shared metadata checks in the Checks section.
- The sticky footer with disabled **Save changes** and **Reset form**, plus a
  working **Reload file** link.

The former generic editor framework, server save action, writer and editor-only
jsonc-parser dependency remain removed. These local resource rows do not restore
that framework.
POST requests cannot save metadata. README and the raw datapackage.json view remain
read-only. Diagnostics are escaped text, never automatically followed links.
No dataset-local configuration weakens the shared policy.

## Run

Use Node.js 24+ and pnpm 12.x. From the `lazydata/` workspace root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
DATASET_ROOT="/absolute/path/to/datasets" pnpm --filter @lazydata/steward dev
```

Open the loopback URL printed in the terminal. Supply the **parent**, not an
individual dataset. Refresh to discover changes; select a name to open its README,
then Metadata for the local-only form/checks or datapackage.json for raw text. Use the
**Datasets** breadcrumb to return to the collection. Missing/unreadable metadata
does not hide other datasets. Refresh reruns read-only checks.

For a built local server:

```sh
pnpm --filter @lazydata/steward build
DATASET_ROOT="/absolute/path/to/datasets" pnpm --filter @lazydata/steward start
```

The start wrapper fixes the host to `127.0.0.1`, rejects `SOCKET_PATH` and uses
port 3000 unless `PORT` is supplied. It pins the request protocol to local HTTP
and ignores client-supplied proxy protocol/host/port headers. Use the wrapper
rather than running build/index.js directly. Development also defaults to loopback.

Pass DATASET_ROOT through the process environment; no dataset path is built into
the app. Missing/unreadable configuration returns an error, not an empty success.
Detailed filesystem failures are logged only to the local terminal. Do not expose
or reverse-proxy this tool onto a network.

Descriptor/README reads are server-only, bounded to 5 MiB and require regular,
single-link, canonical UTF-8 files, not symlinks/hard links. Identity checks detect
ordinary read races, not malicious concurrent ancestor swaps. This is not an OS
sandbox. The app has no permission to repair or replace dataset files.

## Check

```sh
pnpm --filter @lazydata/steward check
pnpm --filter @lazydata/steward test
```

`check` runs Svelte/accessibility diagnostics and strict app/test typechecking.
`test` builds the app, then runs native Node TypeScript filesystem/HTTP tests using
temporary fixtures in dev and built modes. Tests cover the disabled footer,
section targets, refused POSTs and unchanged dataset bytes. No separate linter.
App TypeScript remains 6; validator TypeScript remains 7. App dev/check/build
explicitly compile the workspace validator using its public API and matched policy.

The UI uses the approved shadcn-svelte components and existing Tailwind/Lucide
setup. Server-only markdown-it 15 includes its types. No install hooks are needed;
lifecycle scripts remain disabled. Sidebar defaults use CSS classes instead of
inline width styles, preserving production CSP without unsafe inline styles/scripts.
Development CSS injection uses SvelteKit's own CSP handling.
