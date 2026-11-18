# Validation boundaries

```text
Portable consumers ──> @lazydata/validator
                        policy / metadata / stages / bucket parser

Local tools ─────────> @lazydata/validator/repository
                        portable checks + bundled policy + filesystem checks

lazydata-validate ────> repository adapter

Steward server load ─> portable metadata checks + matched policy
Future full server validation ─> repository adapter (never shipped to the browser)
```

The local Steward app consumes compiled public exports from the existing
workspace validator package. Its server-only adapter parses descriptor text,
shows supplied values and returns portable metadata-check issues. It does not
read resources/buckets or infer/migrate metadata. Raw text remains visible on
invalid JSON. App dev/check/build explicitly compile the validator first; the
shared package remains framework-free. External consumers still use the pinned
compiled release archives described below.

The dashboard UI uses SSR plus browser hydration for shadcn sidebar controls.
Filesystem access and validation stay in server-only modules. List data contains
only folder identity, metadata status and allowlisted supplied summary fields;
raw descriptors remain detail-only. Search/status filters are bounded, validated
GET parameters, never roots or filesystem paths. Workspace counts do not change
with filtering. Normal GET navigation and refresh rerun the read-only checks.

Dataset detail defaults to root README.md; `?view=metadata` retains descriptor
inspection and shared checks. The bounded text reader admits only discovered
datasets and these two server-selected filenames. README availability does not
require a descriptor. Server-only Markdown parsing produces an allowlisted tree,
rendered as escaped Svelte elements/text, never injected HTML. Dataset images and
local link mappings are disabled. Static reviewed README fingerprints support
exact template warnings without runtime access to a sibling template checkout.
This UI warning is not shared validation policy or inferred dataset provenance.

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
