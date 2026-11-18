# Lazydata

Read `README.md`, `docs/architecture.md` and `packages/validator/README.md` first.

- Use pnpm 12.x at this workspace root and in CI. Keep its lockfile; do not require an exact pnpm patch version.
- Target Node.js 24 LTS; keep CI, engine requirements, Node types and docs aligned.
- App slices: discovery/dashboard, README-first viewing, read-only JSON and shared metadata checks in `apps/web/`. Owner scrapped the previous editor. The next explicitly approved increment is only Overview's Name, Title and Description with inline required errors. Prefill these from the current descriptor's supplied strings, retaining blank errors for missing/non-string values. Name/Title share a responsive row; Description is below. Inputs are local overrides; saving is not implemented. Keep navigation/footer, disabled Save/Reset and working Reload. No save endpoint or filesystem writer; do not restore the former editor or add other fields implicitly. See `../tasks/steward-rebuild/metadata-placeholder.md`.
- Approved app tooling: Svelte 5, SvelteKit 3, Node adapter, Vite/Svelte plugin, svelte-check and app-local TypeScript 6. Preserve validator TypeScript 7 and Node types.
- Use installed Svelte/shadcn skills, official docs and autofixer. Keep the user's Sera/taupe dashboard, fonts and scoped `form-ui` control treatment. Retain semantic HTML, bounded reads and escaped text. The app is read-only; tests use synthetic fixtures only.
- The app consumes the workspace validator's compiled public API and policy. Checks remain metadata-only; no resource/bucket scans, migration or inference. README-first viewing is separately approved with server-only markdown-it, escaped allowlisted Svelte nodes and exact reviewed template fingerprints; never inject HTML or load dataset images.
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
