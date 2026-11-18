# Lazydata

Read `README.md`, `docs/architecture.md` and `packages/validator/README.md` first.

- Use pnpm 12.x at this workspace root and in CI. Keep its lockfile; do not require an exact pnpm patch version.
- Target Node.js 24 LTS; keep CI, engine requirements, Node types and docs aligned.
- App slices: discovery/dashboard, README-first viewing, read-only JSON and shared metadata checks in `apps/web/`. The local-only form includes required Overview Name/Title/Description, optional SemVer Version/Created, and Keywords: required Tasks/Projects tags, a required policy-backed Stage dropdown and optional Extra keywords tags. Prefill supplied strings without coercion. Name/Title share a responsive row; Description is below, followed by Version/Created. Created uses a native date input initialized only in the browser; preserve its supplied RFC3339 string until edited, then serialize selected-date midnight with the browser's offset for that date. No inferred date/version defaults. Keywords rows are Tasks/Projects then Stage/Extra keywords. Preserve spaces inside tags. Shared policy still requires exactly one task/project; do not change it implicitly. Keep navigation/footer, disabled Save/Reset and working Reload. No save endpoint/writer; do not restore the former editor or add fields implicitly. See `../tasks/steward-rebuild/version-created.md` and `keyword-fields.md` in that directory.
- Resources is approved: local add/remove rows with matched-policy required fields (currently Name/Title/Path), path-based defaults/suggestions, optional Format and read-only counts. Shared Checks stay metadata-only; only the separate bounded app counter may read resource contents. Preserve path/byte/depth/work limits and stale-result guards. Never infer titles or trust saved counts. No writer. See `../tasks/steward-rebuild/resources.md`.
- Sources is approved: local add/remove rows with required Title and one required URL-or-Path field. Accept only fully qualified HTTP(S) URLs or safe relative POSIX paths; never fetch URLs or read source paths. Keep current shared validation and policy unchanged. No writer. See `../tasks/steward-rebuild/sources.md`.
- Mark required form labels with `*`; leave optional labels unmarked. The Field.Label marker is visual only: preserve native `required`/`aria-required` on controls and existing validation.
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
