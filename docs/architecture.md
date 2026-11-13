# Validation boundaries

```text
Portable consumers ──> @lazydata/validator
                        policy / metadata / stages / bucket parser

Local tools ─────────> @lazydata/validator/repository
                        portable checks + bundled policy + filesystem checks

lazydata-validate ────> repository adapter

Future SvelteKit UI ─> portable checks
Future server code ─> repository adapter (never shipped to the browser)
```

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
No bundler, test framework or runtime dependency is needed. Ship only compiled
modules, the policy and package documentation. The package is private and not yet
published; its name does not claim an existing registry package or namespace.
Consumers must eventually pin one reviewed code-and-policy release. They must
replace duplicated checks, not add this validator alongside competing rules.

Sources: [TypeScript library compiler options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html#im-writing-a-library),
[Node.js 22 package exports](https://nodejs.org/docs/latest-v22.x/api/packages.html#package-entry-points),
[pnpm workspaces](https://pnpm.io/workspaces), and
[pnpm settings](https://pnpm.io/settings).
