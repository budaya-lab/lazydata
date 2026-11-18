# Lazydata

Read `README.md`, `docs/architecture.md` and `packages/validator/README.md` first.

- Use pnpm 12.x at this workspace root and in CI. Keep its lockfile; do not require an exact pnpm patch version.
- Target Node.js 24 LTS; keep CI, engine requirements, Node types and docs aligned.
- Approved app slices: discovery, read-only descriptors, supplied metadata summary and shared metadata-validation display in `apps/web/`; task records live in `../tasks/steward-rebuild/`.
- Approved app tooling: Svelte 5, SvelteKit 3, Node adapter, Vite/Svelte plugin, svelte-check and app-local TypeScript 6. Preserve validator TypeScript 7 and Node types.
- Use installed Svelte/shadcn skills, official docs and autofixer. Dashboard-01 shell/list styling is approved with the user's Sera/taupe setup; retain semantic HTML, bounded reads and escaped text. No editing or dataset writes.
- The app consumes the existing workspace validator's compiled public API and matched policy. Metadata checks only; no resource-file/bucket reads, migration or inferred metadata.
- Keep portable checks free of I/O, Node globals and framework dependencies.
- Keep Node filesystem checks and the CLI in separate entry points.
- Treat parsed metadata and policy as unknown until runtime validation succeeds.
- Bundle policy and compiled code together. Never trust dataset-local policy to weaken checks.
- Validation is read-only: no writes, normalization, repairs, counting or README generation.
- Preserve optional metadata, directory/count rules, path safety and bucket limits.
- Never execute dataset-local scripts or infer provenance or publication permissions.
- Prefer small functions, clear types and blank lines between logical steps.
- Test our dataset/navigation behavior and integration boundaries, not shadcn components or library-specific markup/classes. No source-layout assertions. Preserve isolated package and VM checks.
- Author tests/fixtures in TypeScript and typecheck them; keep generated JavaScript consumer probes as JavaScript.
- Run `pnpm typecheck`, `pnpm test`, app `check`/`test`, `pnpm audit` and `git diff --check` before handoff. App tests use synthetic temporary folders only.
- No separate linter is configured. Say so rather than claiming lint passed.
- Keep workflow **Validate lazydata** and job/check **tests** stable; release gating uses that workflow name.
- Preserve successful-current-main-push release guards, the pinned Release Please action and built-in token.
- One release manages the root and validator package versions; preserve the JSON extra-file updater.
- Publish only compiled, install-tested semver `.tgz` assets from published main-history releases. Never overwrite assets or add standalone checksum files.
- Preserve real URL-install and frozen-reinstall tests; package manager lockfile integrity stays enabled.
- Manually validate each bot-created release PR branch before an owner-approved merge. Never auto-merge or add registry publishing implicitly.
- Do not change consumer repositories, CI/release settings, publish, commit or push without approval.
