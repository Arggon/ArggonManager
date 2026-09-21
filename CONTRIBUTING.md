# Contributing

Thanks for helping with ArggonManager. Work is **convention-first**: the repo (the tracker, Markdown + YAML) is the source of truth for humans and agents.

## Before you start

1. Read [`ArggonManager/docs/convention.md`](ArggonManager/docs/convention.md) (folder layout, frontmatter, statuses).
2. Read [`ArggonManager/docs/engineering.md`](ArggonManager/docs/engineering.md) (review bar, testing, ADRs).
3. Skim ADR [`ArggonManager/docs/adr/0001-cli-stack.md`](ArggonManager/docs/adr/0001-cli-stack.md) if you touch the CLI.

## Issues and PRs

- Prefer a **work item in the tracker** (`arggon create task|bug`) for anything beyond a typo — the tree is the issue tracker; GitHub issues are not used (see `ArggonManager/docs/agents.md` §0).
- Keep PRs **small** and focused; one concern per PR when possible.
- Reference the work item id in the PR; move the item to `done` only when the PR fully finishes it.
- Branch names: `docs/…`, `feat/…`, `fix/…`, `chore/…` (see engineering.md).
- Commits: imperative mood (`docs: …`, `cli: …`, `test: …`).

### PR checklist

- [ ] Linked work item in the tracker (or clear docs-only / chore reason)
- [ ] Matches `ArggonManager/docs/convention.md` if you touch the tracker or templates
- [ ] CLI behavior changes include tests when the CLI is involved
- [ ] User-facing changes update README and/or docs in the same PR

## Run the CLI locally

Requires **Node.js 22.12+** (needed by vitest 5 in the dev toolchain; `engines` enforces it). From the repo root:

- `npm install` (its `prepare` builds both packages)
- `npm run arggon -- hello`
- `npm run arggon -- init /path/to/empty-repo`
- `npm run build`
- `npm test`
- `npm run lint`

Two npm packages make up this repo:

- **`arggon-manager`** — the manifest at the **repo root**: the CLI/headless bin
  (`cli/src/` → `dist/`), the vendored plugin and the runtime assets
  (`templates/`, `skills/`, `opencode/`).
- **`@arggon/lib`** (`lib/`, ADR [`0013`](ArggonManager/docs/adr/0013-lib-package-split.md)) —
  the kernel library (`lib/src/` → `lib/dist/`) that the CLI and the native
  tools consume through the workspace; every `@arggon/lib` import in `cli/`
  resolves through `node_modules` to `lib/dist`.

`npm run build` builds the kernel first, then the root. **Build before running
the suite** (and after any `lib/**` change): the tests that drive surfaces in
process do not need the build (vitest resolves `@arggon/lib` to the kernel
source), but the tests that spawn the real CLI resolve it through
`node_modules` → `lib/dist`, so without a build they fail with
`ERR_MODULE_NOT_FOUND`. CI runs `npm ci` → `npm run build` → `npm test`
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

`arggon start <id> --worktree` links the primary checkout's `node_modules` into
the worktree, so inside a worktree `@arggon/lib` (and every other workspace
package) resolves to the **primary** checkout's build: work that changes `lib/`
must either build where the imports resolve, or give the worktree its own
install — `x-worktree.post-start: npm ci` in `ArggonManager/.convention.yml`
reifies the workspace links locally (and its `prepare` builds them). `arggon
start --worktree` reports the shadowed packages in `linkedWorkspaces` (`--json`,
see [`ArggonManager/docs/json-output.md`](ArggonManager/docs/json-output.md)) and on stdout.

## Propose schema / convention changes

1. Open an issue describing the change and why (agents + humans must share one rule).
2. Update **`ArggonManager/docs/convention.md`** in the same PR as any CLI/validate behavior that depends on it.
3. Update sample the tracker and `templates/` when the change affects them.
4. Breaking changes need an ADR under `ArggonManager/docs/adr/` and a bump of the tracker `.convention.yml` `version` when applicable.
5. Do **not** invent unofficial frontmatter keys outside the reserved `x-*` / `extensions` rules in the convention.

## Claim work

Follow claim rules in the convention: for `story` / `task` / `bug`, `in_progress` requires an `assignee`. Prefer claiming via the CLI when those commands exist; until then, edit frontmatter + open a PR.

## License

MIT — see [LICENSE](LICENSE).
