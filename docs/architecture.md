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
options, initial shared issues and descriptor text cross the detail-load boundary.
Descriptor text stays detail-only and uses SvelteKit's escaped data serialization;
it is not copied into dashboard results or static assets.

Inputs are local overrides, reset when loaded overview data changes. Tag entry
commits on Enter/comma/blur, retains internal spaces and avoids new exact
duplicates. Removing a tag returns focus to its input. Name/Title share a responsive
row with Description below; Keywords rows are Tasks/Projects then Stage/Extra
keywords. Created comes first, then Version in equal-width columns, without
format help or a timestamp preview. Created's native date input initializes only
on browser mount; SSR does
not choose the server's time zone. The original RFC3339 value is retained until a
date edit prepares local midnight with the selected date's actual offset. Invalid
calendar values and unrepresentable midnights are rejected rather than normalized.
Its hidden RFC3339 control is local form state, not a persistence interface. Shared
validation policy is unchanged, including its existing date-time checks; SemVer
format checking is local UI validation only.

Resources uses the matched resource required-fields policy (currently Name,
Title and Path). Full draft issues reuse the portable validator in Checks;
no resource validation rules are forked. Inline errors stay beside fields, but
the repeated section-level error list is removed. Pure
helpers extract supplied strings without hiding missing metadata. Explicit path
edits fill and sync Name/Format defaults while preserving manual overrides;
count support is irrelevant. Missing loaded Name stays blank and visibly required. No supplied count is trusted. Array paths/malformed
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

There is no save path. The navigation label is Issues (#). Initial validation
results come from the saved descriptor. Owner chose future Save behavior that
allows incomplete drafts while retaining visible issues; this does not waive
request/filesystem safety checks or stale-file conflict detection.
After edits, a browser-only 500 ms debounce checks the current validation snapshot.
Every section reports changes, including pending tag text. Pending checks hide old
results and show Checking; revision tokens/cancellation prevent obsolete timers
from publishing, and teardown cancels work on navigation. A synchronous flush is
tested for future explicit Save integration, but Save remains disabled.

The owner simplified the [draft model](steward-save.md): `metadata-draft.ts` owns
one working object. Controls update its properties/arrays directly; JSON preview
and checks use `JSON.stringify` serialization. Text/AST editing, local patch
operations, cumulative journal and the legacy validation overlay are removed.
Unknown properties, unsupported untouched data and path-only licenses remain.
Row/license references keep extra metadata with surviving entries. Resource
callbacks include path-generated Name/Format in path edits, but never counter
results. Shared policy
remains unchanged.

A page-scoped `metadata-session.ts` owner retains that working object and the
captured revision; router results cannot silently replace them. Form props derive
from a stable saved-model reference so draft notifications do not reset inputs. Metadata remains
mounted while hidden, retaining its controls, pending inputs and baseline row IDs.
Once Metadata has been opened, Metadata/JSON links use SvelteKit 3 shallow routing
and display the same draft without descriptor reloads. Direct JSON visits before
that still display saved text. Other-dataset callbacks are refused, owners are
isolated, and leaving/reloading changed drafts prompts for confirmation.

Unsupported edits and partial native dates retain input and surface sync errors;
the JSON view explicitly labels the last representable text. A future Save must
not ignore those errors. Direct JSON input/rebinding is later work; no raw-text
editor can currently reorder rows or mutate the form baseline.

Both views will use one `{ revision, text }` Save request. The server selects the
descriptor, validates untrusted candidate text, recomputes metadata issues and
performs revision/filesystem checks before writing those exact bytes. There is
no server field/row patch protocol or form/raw submission-mode split. Local form
allowlists do not restrict deliberate direct JSON edits to unexposed properties.
Metadata issues alone remain nonblocking; malformed requests/candidates and
filesystem conflicts remain failures. Keep newer edits after a Save response.

`metadata-json.ts` uses approved jsonc-parser 3.3.1 only as an admission visitor:
strict/unique-key object JSON, bounded size/depth/value count and safe decimal
number round-trips. Reject numeric rounding, overflow, underflow, negative zero
and numeric tokens over 1,024 characters instead of silently changing hidden data.
Unsafe/malformed documents retain original JSON viewing and explicit editing
errors. Formatting/escapes/number notation may normalize; dirty tracking compares
normalized values. Explicit edits may replace unsupported field values, not whole
unsupported rows/containers. `dataset-text-limits.ts` still shares the reader's
5 MiB limit. Browser code uses TextEncoder; reads remain server-only. The Vite
bundle/VM probe confirms portability, not DOM behavior. Owner confirmed the prior
sync/input fix; this simpler path, buffer/clear UX and persistence need review.

Save/Reset remain disabled. The former editor has not been restored; no Save
handler/writer exists and POST is refused with 405. The JSON view is still read-only;
synchronization changes only browser state. No dataset files are written. Transaction/platform limits
and the revised implementation order are in the shared draft/Save contract.

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
