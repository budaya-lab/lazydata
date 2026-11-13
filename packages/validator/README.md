# Dataset validator

Read-only validation for dataset metadata and local repositories. This private,
unreleased package is the new home of the shared validator previously developed
in `tpl-dataset`. It has no runtime dependencies or SvelteKit imports.

## Portable API

Import from `@lazydata/validator` after building the package:

| Function | Result |
| --- | --- |
| `validatePolicy(policy)` | Error strings; `[]` means valid policy. |
| `validateMetadata(data, policy)` | Metadata error strings, without inspecting files. |
| `getStage(keywords, policy)` | Controlled stage name, or `undefined` when absent. |
| `stageLabel(keywords, policy)` | Display label, or `undefined` when absent. |
| `parseBuckets(textOrBytes)` | `{ labelColumn, rows }` from text or `Uint8Array`. |

Metadata, policy and keyword arguments accept `unknown`. The package validates
these inputs at runtime; TypeScript types do not replace validation. Exported
types include `DatasetPolicy`, `PackageField`, `ResourceField`, `Buckets` and
`BucketRow`. Policy fields are readonly.

Invalid policy makes metadata/stage functions throw. Stage helpers also throw
for malformed keywords or duplicate/unknown stages. They permit missing stages
and do not require task/project keywords, so catalogue display remains distinct
from full dataset validation. Bucket parsing throws for malformed content.

The portable entry point performs no I/O and does not use Node globals. Load
policy from the same package, then pass it to the functions. For example:

```ts
import { validateMetadata, stageLabel } from '@lazydata/validator';
import policy from '@lazydata/validator/policy' with { type: 'json' };

const errors = validateMetadata(descriptor, policy);
const label = stageLabel(keywords, policy);
```

JSON-loading syntax depends on the consumer's environment. The example works in
Node.js 22; SvelteKit/browser integration has not been implemented or verified.

## Local repository API

```ts
import { validateDataPackage } from '@lazydata/validator/repository';

const errors = validateDataPackage(descriptor, datasetRoot);
```

The root defaults to the current working directory. The Node-only adapter loads
its own bundled policy on each call, never a dataset-local configuration. It
adds file existence, realpath containment, resource type, directory-format and
bucket checks. Missing or invalid bundled policy throws rather than passing.
Importing either API entry point does not start the CLI.

## Command line

From the Lazydata workspace:

```sh
pnpm build
node packages/validator/dist/cli.js /path/to/dataset
```

An installed package exposes `lazydata-validate [dataset-root]`; no root argument
means the current directory. `--help` prints usage. Success exits 0; invalid
metadata, policy, paths, arguments or unreadable JSON exit 1. Descriptor read/parse
errors do not print descriptor contents or local absolute paths. The command never
runs scripts from the dataset.

## Bundled policy

`dataset.config.json` declares schema version 1, stages, required package/resource
fields, keyword rules and bucket presence. Unknown policy keys and unsupported
requirements are errors. See the file for the exact default:

- Require package name, title, description, keywords and nonempty resources.
- Require unique resource names, titles and safe relative paths.
- Require exactly one nonblank `task:`, `project:` and controlled `stage:` keyword.
  Other nonblank keywords are allowed.
- Keep provenance, counts and buckets optional, but validate supplied values.
- A directory is one resource and must omit `format`.
- `count` is a non-negative safe integer for items, separate from `bytes`.
- Optional root buckets require exactly a label column followed by `count`, unique
  nonblank labels, safe non-negative integer counts and at least one row. Enforce
  UTF-8, strict CSV quoting, a 1,000,000-byte limit and a regular non-symlink file.

Policy cannot disable path containment, count range checks or bucket limits.
No supplied metadata is normalized, repaired or inferred. Validation never
counts resources, writes files or generates READMEs. It checks selected metadata
and references, not full Data Package conformance, other resource contents,
confidentiality, licensing authority or permission to publish.

## Distribution and adoption

`pnpm pack:validator` at the workspace root builds a local archive containing
compiled JavaScript, declarations, this guide and matched policy. The package
name is a local workspace name, not a claim to a registry namespace. Release Please
manages reviewed repository-wide GitHub releases and keeps this package version
aligned with the workspace. Packages stay private; no registry publication or
compiled release-archive upload is configured. See the
[release guide](https://github.com/budaya-lab/lazydata#ci-and-releases).

Future consumers must pin one reviewed code-and-policy release. Do not fetch
moving branches, copy source into datasets or depend on sibling checkouts.
The template's current validator remains working during extraction; template,
Steward and portal cutovers are separate reviewed steps. Replace their duplicated
common rules on adoption while retaining environment-specific checks and writes.

Tests run compiled code, frozen inputs, filesystem snapshots, a portable VM,
CLI failures and an unpacked consumer with no runtime dependencies. The artifact
test also compiles consumer types and invokes the executable through a symlink.
The test suite currently needs pnpm and `tar`; local verification is on macOS.
CI targets Node.js 22. Real-browser verification remains separate from VM tests.
