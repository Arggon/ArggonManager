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
- `npm run test:structure`
- `npm run lint:structure`

Two npm packages make up this repo:

- **`arggon-manager`** — the manifest at the **repo root**: the CLI/headless bin
  (`cli/src/` → `dist/`), the vendored plugin and the runtime assets
  (`templates/`, `skills/`, `opencode/`).
- **`@arggondev/lib`** (`lib/`, ADR [`0013`](ArggonManager/docs/adr/0013-lib-package-split.md)) —
  the kernel library (`lib/src/` → `lib/dist/`) that the CLI and the native
  tools consume through the workspace; every `@arggondev/lib` import in `cli/`
  resolves through `node_modules` to `lib/dist`.

`npm run build` builds the kernel first, then the root. **Build before running
the suite** (and after any `lib/**` change): the tests that drive surfaces in
process do not need the build (vitest resolves `@arggondev/lib` to the kernel
source), but the tests that spawn the real CLI resolve it through
`node_modules` → `lib/dist`, so without a build they fail with
`ERR_MODULE_NOT_FOUND`. CI runs `npm ci` → `npm run build` → `npm test`
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

`arggon start <id> --worktree` prepares a fresh worktree for the project gate
and for worktree-local resolution: when the primary checkout has a
`node_modules` and the worktree does not, start mirrors the primary install as a
**link farm** (a real `node_modules` directory whose entries link the primary's
packages). A workspace package the worktree carries its own copy of — here
`@arggondev/lib` — resolves to the **worktree copy**: start runs that package's own
`build` script before the claim commit when the copy has no build output yet, so
the pre-commit gate loads the branch's kernel. A copy that could not be built
stays on the primary's install and is reported in `linkedWorkspaces` (`--json`,
see [`ArggonManager/docs/json-output.md`](ArggonManager/docs/json-output.md)) and
on stdout; the worktree-local builds are reported on stdout too. A full
worktree-local install is still the npm-native alternative: `npm ci`, or
`x-worktree.post-start: npm ci` in `ArggonManager/.convention.yml`, reifies the
workspace links locally and its `prepare` builds them.

Rebuild after changing `lib/`: the worktree's spawned CLI and the tests that
launch it resolve `@arggondev/lib` through `node_modules` → `lib/dist`
(`npm run build --workspace @arggondev/lib`), and the flip means the worktree's own
build is what runs.

### Structural architecture checks (dev-only)

The exact-pinned `@ast-grep/cli` devDependency guards two architecture seams that
ESLint/TypeScript do not express: tracker item mutations must stay in the shared
kernel, and native tool registration must stay on the shared catalog seam. Run its
positive/negative rule tests and the deterministic repository scan with:

- `npm run test:structure`
- `npm run lint:structure`

Both CI commands run in the existing `cli` job. The scan uses the `Tsx` superset
parser for hand-authored `.ts`/`.tsx` files, so JSX production code such as
`opencode/plugins/arggon/tui.tsx` is covered by the same rule IDs. The scan only
reports violations; it never uses `--update-all` or rewrites source. The native
exception is limited to the catalog-definition loop and its exact editor payload;
tracker root migration has one documented inline suppression. Rule scope,
production exceptions, the bare-`filePath` decision, and explicit test-helper
exclusions are documented in [`tools/ast-grep/README.md`](tools/ast-grep/README.md).

### UI smoke tests (dev-only)

The `ui-smoke` CI job runs the durable smoke net for the board and the TUI
([ADR 0008](ArggonManager/docs/adr/0008-review-smoke-gate.md)); the review-time
browser gate stays the Playwright CLI drive described in
`ArggonManager/docs/engineering.md` § Smoke test. Locally:

- `npm run build` — both specs drive the **built** bin on a temp fixture
- `npx playwright install chromium` — once per machine; `@playwright/test` is a
  devDependency and never ships
- `npx playwright test --grep @smoke` — board smoke: `board --serve` renders one
  card per `arggon list` item, one status move round-trips through the UI and
  persists (`arggon show`)
- `npm run smoke:tui-board` — TUI frame check: `arggon board --tui` renders in a
  pty and the capture carries the five status headers plus a seeded item id
  (skips cleanly where util-linux `script` is unavailable)

The Playwright specs live in `e2e/`, outside vitest's include globs, so
`npm test` never picks them up.

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
