# Dataset validator

Read-only metadata and local-repository checks. Includes compiled JavaScript,
types and matched policy, with no runtime dependencies.

## Install

Use Node.js 24+. The source package is now `@penjaga/validator`, with CLI
`penjaga-validate`. No renamed release archive has been published yet. To test
the renamed package locally, run `pnpm pack:validator` from the Penjaga workspace
root, then install the resulting `penjaga-validator-VERSION.tgz` in a consumer
with `pnpm add --save-exact --ignore-scripts /absolute/path/to/the/archive.tgz`.
Run `pnpm exec penjaga-validate /path/to/dataset`.

Published releases through v1.1.0 retain their original package and CLI names.
For example, this existing release remains installable:

```sh
VERSION=1.1.0
pnpm add --save-exact --ignore-scripts \
  "https://github.com/budaya-lab/penjaga/releases/download/v${VERSION}/lazydata-validator-${VERSION}.tgz"
pnpm exec lazydata-validate /path/to/dataset
```

That historical archive exports `@lazydata/validator`, not `@penjaga/validator`.
The API examples below target the renamed source package. Pin the chosen archive
URL and commit the lockfile. Consumers need no compiler or build step; packages
are not published to a registry.

## Portable API

These functions perform no I/O and do not mutate inputs.

| Function | Result |
| --- | --- |
| `validatePolicy(policy)` | Error strings; `[]` means valid. |
| `validateMetadata(data, policy)` | Metadata error strings. |
| `getStage(keywords, policy)` | Stage or `undefined`. |
| `stageLabel(keywords, policy)` | Stage label or `undefined`. |
| `parseBuckets(textOrBytes)` | `{ labelColumn, rows }`. |

```ts
import { validateMetadata } from '@penjaga/validator';
import policy from '@penjaga/validator/policy' with { type: 'json' };

const errors = validateMetadata(descriptor, policy);
```

Metadata/stage functions throw for invalid policy; `parseBuckets` throws for
invalid CSV. Stage helpers allow missing catalogue stages but reject malformed
keywords, duplicate stages and unknown stages.

## Local repository API

```ts
import { validateDataPackage } from '@penjaga/validator/repository';

const errors = validateDataPackage(descriptor, datasetRoot);
```

The root defaults to the current directory. This Node-only adapter uses its own
bundled policy, never dataset-local configuration. Descriptor/filesystem issues
return error strings; unreadable or invalid bundled policy throws.

The CLI also defaults to the current directory. Use `--help` for usage; exit codes
are 0 for valid and 1 for errors. It never runs dataset-local scripts.

Validation does not edit files, count resources or infer metadata. These are
selected checks, not full Data Package conformance or permission to publish.
See [policy](dataset.config.json) and the
[validation reference](https://github.com/budaya-lab/penjaga/blob/main/docs/reference.md#validation)
for field rules, limits and safety boundaries.
