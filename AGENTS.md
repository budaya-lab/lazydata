# Lazydata

Read `README.md`, `docs/architecture.md` and `packages/validator/README.md` first.
This is a fresh TypeScript project. Do not reuse the old Python/Textual experiment.

- Use pnpm at this workspace root. Keep its lockfile and package-manager pin.
- Only TypeScript and Node types are approved dependencies for this slice.
- The SvelteKit application is deferred. Do not scaffold UI or add its dependencies yet.
- Keep portable checks free of I/O, Node globals and framework dependencies.
- Keep Node filesystem checks and the CLI in separate entry points.
- Treat parsed metadata and policy as unknown until runtime validation succeeds.
- Bundle policy and compiled code together. Never trust dataset-local policy to weaken checks.
- Validation is read-only: no writes, normalization, repairs, counting or README generation.
- Preserve optional metadata, directory/count rules, path safety and bucket limits.
- Never execute dataset-local scripts or infer provenance or publication permissions.
- Prefer small functions, clear types and blank lines between logical steps.
- Add behavior tests, not source-layout assertions. Preserve isolated package and VM checks.
- Run `pnpm typecheck`, `pnpm test`, `pnpm audit` and `git diff --check` before handoff.
- No separate linter is configured. Say so rather than claiming lint passed.
- Keep workflow **Validate lazydata** and job/check **tests** stable; release gating uses that workflow name.
- Preserve successful-current-main-push release guards, the pinned Release Please action and built-in token.
- One release manages the root and validator package versions; preserve the JSON extra-file updater.
- Manually validate each bot-created release PR branch before an owner-approved merge. Never auto-merge or add registry publishing implicitly.
- Do not change consumer repositories, CI/release settings, publish, commit or push without approval.
