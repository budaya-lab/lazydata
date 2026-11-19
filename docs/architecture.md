# Validation boundaries

```text
Portable consumers ──> @lazydata/validator
                        policy / metadata / stages / bucket parser

Local tools ─────────> @lazydata/validator/repository
                        portable checks + bundled policy + filesystem checks

lazydata-validate ────> repository adapter

Steward reads ──────> portable metadata checks + matched policy
Future full server validation ─> repository adapter (never shipped to the browser)
```

The local Steward app consumes compiled public exports from the existing
workspace validator package. Its server-only adapter parses descriptor text,
shows supplied values and returns portable metadata-check issues. Those checks do
not read resources/buckets or infer/migrate metadata. The separately approved
Resources UI can list safe root paths and request bounded server-only counts;
that is not part of validation. Raw text remains available in
the separate datapackage.json view, including on invalid JSON. App dev/check/build explicitly compile the validator first; the
shared package remains framework-free. External consumers still use the pinned
compiled release archives described below.

The dashboard UI uses SSR plus browser hydration for shadcn sidebar controls.
Filesystem access and validation stay in server-only modules. List data contains
only folder identity, metadata status and allowlisted supplied summary fields;
raw descriptors remain detail-only. Search/status filters are bounded, validated
GET parameters, never roots or filesystem paths. Workspace counts do not change
with filtering. Normal GET navigation and refresh rerun the read-only checks.

Dataset detail defaults to root README.md. `?view=metadata` contains a form
with local-only Overview/Keywords/Resources/Contributors/Licenses/Sources controls, section navigation, disabled Save/Reset, Reload and read-only checks. `?view=datapackage` is read-only raw text. The bounded text reader admits only discovered
datasets and these two server-selected filenames. README availability does not
require a descriptor. Server-only Markdown parsing produces an allowlisted tree,
rendered as escaped Svelte elements/text, never injected HTML. Dataset images and
local link mappings are disabled. Static reviewed README fingerprints support
exact template warnings without runtime access to a sibling template checkout.
This UI warning is not shared validation policy or inferred dataset provenance.

The owner scrapped the former editor and is rebuilding the form incrementally.
Overview has Name, Title and Description with live blank/whitespace-required
errors. Optional Version/Created follow Description on a responsive row. Version
has local strict SemVer validation without numeric coercion. Their supplied text
is passed through; missing fields are blank and invalid supplied types use null
sentinels so the controls can show errors without stringifying malformed values.
Keywords has required Tasks/Projects tags, a required Stage dropdown and
optional Extra keywords tags. The server extracts exact task/project/stage
prefixes from supplied keyword strings, without coercion or inference. Supplied
tag strings/spaces/duplicates are retained; missing/unknown/multiple stages leave
an empty selection. Stage options and labels come from the same compiled package
policy used by shared checks, not dataset-local configuration. The shared
exactly-one task/project policy is unchanged. Only these form values, policy
options and shared issues cross the detail-load boundary.

Inputs are local overrides, reset when loaded overview data changes. Tag entry
commits on Enter/comma/blur, retains internal spaces and avoids new exact
duplicates. Removing a tag returns focus to its input. Name/Title share a responsive
row with Description below; Keywords rows are Tasks/Projects then Stage/Extra
keywords. Created's native date input initializes only on browser mount; SSR does
not choose the server's time zone. The original RFC3339 value is retained until a
date edit prepares local midnight with the selected date's actual offset. Invalid
calendar values and unrepresentable midnights are rejected rather than normalized.
Its hidden RFC3339 control is local form state, not a persistence interface. Shared
validation policy is unchanged, including its existing date-time checks; SemVer
format checking is local UI validation only.

Resources uses the matched resource required-fields policy (currently Name,
Title and Path). Its live draft issues reuse the portable validator, subtracting
package-only baseline issues; no resource validation rules are forked. Pure
helpers extract supplied strings, derive absent filename/format defaults and
preserve manual overrides. No supplied count is trusted. Array paths/malformed
types are not coerced into text. Rows add/remove locally with stable IDs.

The metadata loader lists safe root files/folders without reading resource
contents. A separate GET `/datasets/[name]/resources?path=...` counts on demand.
Only discovered datasets beneath configured DATASET_ROOT qualify. Unsafe/hidden
paths, links and special files are refused; no URLs are fetched. Canonical-path,
no-follow/nonblocking opens, file identity and before/after directory checks
protect reads, without claiming a sandbox against hostile concurrent FS mutation.
Counts return totals/units or sanitized status, never contents/absolute paths.

Counter rules: CSV/TSV logical records minus header, top-level JSON array items,
nonblank valid JSONL records, recursive regular-file totals for directories.
Directory Format is blank locally. Unsupported formats/shapes are explicit;
invalid/unreadable/limited inputs never become false zero/saved counts. The
8 MiB, 10,000-entry, 32-directory-level, 128-JSON-level and 5-second limits bound
work. At most two counters run; per-form client queues serialize requests and
skip obsolete queued paths. Row sequence guards reject stale completions. SSR
never triggers counting; browser mount, path blur and recount do. Forms have at
most 200 rows, 1,000 suggestions; listing is capped at 10,000 root entries.
No shared validator code or policy is changed.

Sources uses local add/remove rows for Title and one `path` field displayed as
“URL or Path”. Both are required in the form. Local syntax accepts a fully
qualified HTTP(S) URL or safe relative POSIX path; the app does not fetch URLs or
read source paths. Source prefill avoids coercing malformed values. This local
form requirement does not change the shared validator, which continues to check
saved sources under its existing policy. No source is saved or migrated.

Licenses is an optional name-only tag field under the current policy. Datalist
suggestions provide common SPDX identifiers while allowing custom identifiers;
new draft values reuse shared validator checks. Supplied name strings are shown
unchanged. Path-only/malformed entries are not converted to names and remain in
the untouched raw descriptor. Tags map locally to `{ name }`; no writer or policy
change is introduced.

Contributors uses stable-ID local add/remove rows. Name maps only to the supplied
Data Package `title`, not inferred names or legacy fields. Each local row requires
a name; Roles is optional and reuses the license tag control with suggestions
and custom text. Role checks reuse the portable validator. Supplied string arrays
retain order, duplicates and spaces; unsupported name/role types use null sentinels
and show warnings instead of coercion. The form caps rows at 200. Shared policy
and saved-descriptor checks do not change.

There is no save path. Read-only Checks remain saved-descriptor checks.
Navigation/footer remain; Save/Reset stay disabled. There is no former editor
model, submission parser, patcher, writer or save action. POST is refused with 405; the disabled footer is not a
write boundary. No dataset files are written. The editor-only jsonc-parser
dependency and its lock records were removed; other versions remain unchanged.

The Node startup wrapper pins loopback and supplies a trusted HTTP protocol header
before the adapter handles requests; client proxy headers never define the origin.

The validator owns the common rules and matched default policy. It accepts
untrusted input and returns error strings. Invalid policy and invalid bucket
contents throw; repository validation returns descriptor/filesystem issues but
throws when its bundled policy cannot be loaded or validated.

The portable entry point performs no I/O. Callers supply policy loaded from the
same package. Catalogue stage display permits a missing stage; full dataset
validation requires the configured task, project and stage keywords.

The Node adapter loads policy relative to its installed package, never from the
dataset root. It verifies referenced paths and optional root buckets without
counting data, rewriting files or running dataset-local code. Validation is not
a sandbox against concurrent filesystem changes and does not authorize later reads
or writes. Future application transactions need their own safety checks.

Build with TypeScript's NodeNext modules and emit JavaScript plus declarations.
No bundler, test framework or runtime dependency is needed. GitHub release `.tgz`
assets contain compiled modules, declarations, policy and package documentation.
The publisher builds the tagged main-history commit and verifies the exact
archive through a fresh URL install and frozen offline reinstall before upload.
Consumers pin the stable semver URL and commit their lockfile. No separate
checksum files or registry publishing are used; normal package manager integrity
is unchanged. Packages remain private and their names do not claim a registry
namespace. Consumers replace duplicated checks, not add this validator alongside
competing rules.

Sources: [TypeScript library compiler options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html#im-writing-a-library),
[Node.js 24 package exports](https://nodejs.org/docs/latest-v24.x/api/packages.html#package-entry-points),
[pnpm workspaces](https://pnpm.io/workspaces), and
[pnpm settings](https://pnpm.io/settings).
