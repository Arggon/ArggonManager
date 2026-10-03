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
- `npm run smoke:native-start-cold` — cold-start smoke for the native
  `tools.arggon.start` worktree path (below)

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

The exact-pinned `@ast-grep/cli` devDependency is a **high-confidence
structural guard** for two architecture seams that ESLint/TypeScript do not
express: tracker item mutations must stay in the shared kernel, and native tool
registration must stay on the shared catalog seam. Run its positive/negative rule
tests and the deterministic repository scan with:

- `npm run test:structure`
- `npm run lint:structure`

Both CI commands run in the existing `cli` job. The scan uses the `Tsx` superset
parser for hand-authored `.ts`/`.tsx` files, so JSX production code such as
`opencode/plugins/arggon/tui.tsx` is covered by the same rule IDs. The scan only
reports violations; it never uses `--update-all` or rewrites source.

What the guard does and does not claim:

- **Tracker rules** are path-position only: multi-argument `rm`/`rmdir`/`unlink`/
  `truncate` are inspected at their first path argument like the writers, and
  content arguments are never scanned. A bare leaf file name is intentionally not
  a tracker signal, so ordinary product writes such as
  `join(root, "docs", "task-beta.md")` stay valid. Rename destinations have a
  separate rule, and tracker root migration has one documented inline suppression.
- **The native rule is scoped to the hand-authored Arggon plugin sources**
  (`opencode/plugins/arggon/**/*.ts(x)`), not the whole repository, and its
  exception is limited to the direct catalog-to-editor binding and exact payload.
  Deliberate, computed, or destructured indirection is outside structural scope
  and is not claimed to be covered; plugin schema/parity tests remain
  authoritative for those shapes.
- **The ordering rule is scoped to test files** (`**/*.test.ts(x)`,
  `**/*.spec.ts(x)`): a positional comparison of an `indexOf` result inside
  `expect(...)` is rejected, because `indexOf` answers `-1` for an absent
  substring and `-1` sorts before every real index, so the assertion would pass
  on a clause that is not in the message at all. Use `assertOrder` from
  `test/assert-order.ts`, which requires each clause to be present before it
  compares positions. A numeric literal on the right is exempt only where the
  comparison genuinely fails on `-1` (`toBeGreaterThan(n >= -1)`,
  `toBeGreaterThanOrEqual(n >= 0)`). `indexOf` used as a **parser** asserts
  nothing and is untouched, and an index carried in an intermediate variable is
  outside structural reach.

These rules are not comprehensive semantic enforcement. Rule scope, the exact
structural limitations, production exceptions, content/path decisions, and
explicit test-helper exclusions are documented in
[`tools/ast-grep/README.md`](tools/ast-grep/README.md).

### Native start cold-start smoke (dev-only)

`npm run smoke:native-start-cold` (`smoke/native-start-cold-smoke.ts`) is the
durable, **deterministic and model-free** regression gate for the native
`tools.arggon.start` worktree path — the path that used to hand back a cold
worktree whose dependency-requiring pre-commit gate could not run, with the
claim commit silently absent. It needs no OpenCode runtime, no model and no
quota, so it is safe to run beside anything; `npm run smoke:opencode` and
`npm run smoke:opencode:wave` remain the **model-driven** evidence and are run
on their own (see [OpenCode 2 notes](ArggonManager/docs/opencode2.md)).

**It runs in CI.** The `cli` job runs it as its last step
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)), after the
`npm run build` it depends on and beside the other dev-only node gates
(`test:structure`, `lint:structure`). The step is blocking — a non-zero exit
fails the lane, so `0` is the only result that passes — and it deliberately
carries no `continue-on-error`, no `|| true` and no advisory `if:`. It is
offline, model-free and Chromium-free, so it belongs to `cli` and not to the
`ui-smoke` job, and it needs no second install. A run costs well under a
second (observed ~0.5s: five consecutive local runs at 0.47-0.48s, 20/20 checks
each), which is why it gates every PR instead of sitting behind a label.

What the CI lane does **not** claim: this is a deterministic, offline check of
the native worktree/start path only. It does not replace the model-driven
`smoke:opencode` transcript, which stays the runtime-level evidence and is
still maintainer-run (and still quota-bound), and it proves dependency
_resolution_ through a synthesized install, not npm's reifier.

One run (`npm run build` first, so this checkout's kernel is built) builds a
disposable git fixture under `$TMPDIR` — a primary checkout with an initialized
tracker, a project install and a real executable `pre-commit` gate that
resolves a dependency only that install carries — and then:

1. proves the gate **fails** in a cold worktree (no `node_modules`), so the
   scenario cannot pass by bypassing it;
2. drives the **actual native tool** (this checkout's
   `opencode/plugins/arggon/index.ts` plus a `ctx.worktree` domain double backed
   by real `git worktree`) and requires an explicit, bounded readiness /
   claim-commit receipt, a claim commit whose only path is the item file, and
   the gate's marker written inside the worktree start prepared;
3. re-runs `start` to prove a deterministic attach, no duplicate claim commit
   and no mutation of either install — the fixture's and this repository's
   canonical checkout, whose `node_modules` fingerprint (entry count, entry-set
   digest, mtime) must be identical before and after;
4. removes the worktree, its git registration and the whole disposable root, and
   asserts this checkout's working tree is byte-identical to how it started.

Exit codes: `0` passed, `1` a check failed (the fixture is kept for inspection),
`2` the harness could not run. `ARGON_NATIVE_START_SMOKE_KEEP=1` keeps the
fixture on success too. In CI only `0` is green — `1` and `2` both fail the
job — and the harness prints the plugin source and kernel build it resolved, so
a red run names the runtime that produced it.

### UI smoke tests (dev-only)

The `ui-smoke` CI job runs the durable smoke net for the board and the TUI
([ADR 0008](ArggonManager/docs/adr/0008-review-smoke-gate.md)); the review-time
browser gate stays the Playwright CLI drive described in
`ArggonManager/docs/engineering.md` § Smoke test. Locally:

- `npm run build` — both specs drive the **built** bin on a temp fixture
- `npx playwright install chromium` — once per machine; `@playwright/test` and
  `@axe-core/playwright` are devDependencies and never ship
- `npx playwright test --grep @smoke` — board smoke: `board --serve` renders one
  card per `arggon list` item, one status move round-trips through the UI and
  persists (`arggon show`), and the ready page carries no WCAG A/AA
  accessibility violation
- `npm run smoke:tui-board` — TUI scripted pty session: `arggon board --tui`
  renders, then 14 scripted steps drive it (live refresh without a keypress,
  ready lens on/off, priority/next sorts, `/` filter, detail pane, split-PgDn
  paging with the pane held open, board restored) before quitting with `q`
  (skips cleanly where util-linux `script` is unavailable)

The Playwright specs live in `e2e/`, outside vitest's include globs, so
`npm test` never picks them up. The `@smoke` command is also the `ui-smoke` CI
job's browser step, so a local green run is the evidence CI will reproduce.

#### Accessibility gate (axe)

The `@smoke` lane runs [axe](https://github.com/dequelabs/axe-core)
(`@axe-core/playwright`, version-pinned, dev-only) against four board states,
each gated on its own deterministic readiness signal (an `expect` on a settled
element — never a sleep, never a `networkidle` guess): the **served ready
page** (first test, before any interaction — including a fixture-rendered
**empty status column**, so the `.empty` placeholder's contrast is actually
asserted), the **open detail drawer** (right after the acceptance-row count
proves the async `/api/item` content has rendered), the **static `file://`
export** (after its `h1`; a separate document, so an export-only regression is
caught) and the **filtered/lens state** (after the narrowed-card count, with
the `.empty` placeholders the filter creates). It is a gate, not a report: a
violation fails the test.

**What is asserted.** Every WCAG A/AA level axe can check automatically, across
all three WCAG versions it ships rules for:

```
wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa
```

AAA is out of scope (axe automates almost nothing at that level).
`best-practice` is out of scope by a recorded decision
([task-axe-board-drawer-and-lens-coverage](ArggonManager/arggon-manager/ui/ui-foundation/task-axe-board-drawer-and-lens-coverage.md)):
it is not a conformance level, and its rule surface has never been audited on
this board, so asserting it wholesale would trade a green gate for an unaudited
one. The one `best-practice` finding the ready page used to report — `region`
on the filter bar — is **fixed**, not excluded: `#board-filterbar` carries
`role="search"` (aria-label "board filters"), so the filter controls live in a
landmark. Widening the tag set to `best-practice` is a deliberate follow-up:
audit the current best-practice rule list against every scanned state above,
fix or file each finding, and only then widen.

**The policy, in short: no blanket exclusions.** There is no `disableRules`, no
`exclude`, no `include` and no narrowed rule list anywhere in
`e2e/board.smoke.spec.ts`, and there are **zero accepted exceptions** today.
Adding one means a comment at the call site naming the exact rule id, why the
violation is not a defect a contributor can fix, and an owner (a person or a
tracked item id) — plus a matching line in this section and in
`ArggonManager/docs/engineering.md` § Smoke test. A real defect is fixed in the
board's own CSS/HTML or filed as a linked tracker item; it is never excluded to
get a green lane.

**When the scan fails.** The failure message is the remediation surface: every
violation is printed with its rule id, impact, the WCAG tags it carries, the
offending node's selector and HTML, and a link to the rule's own remediation
page. In practice:

1. Read the rule id. `color-contrast` means a foreground/background pair in
   `cli/src/board.ts` is below 4.5:1 at the size it renders; `label`,
   `button-name` or `aria-*` means an element is missing an accessible name,
   role or state.
2. Reproduce it exactly as CI does — `npm run build`, then
   `npx playwright test --grep @smoke` — and read the printed target selector.
   That selector is a real element of the board page, so the fix belongs in
   `cli/src/board.ts`, not in the spec.
3. Fix the board and re-run. If the fix is bigger than the defect — a landmark
   restructure, a keyboard-interaction change, a design question — file a `task`
   carrying the rule id, the target selectors and the measured ratio, then
   reference that item id in the call-site comment.
4. Never add a `disableRules` entry to make the lane pass: that converts a
   tracked defect into an invisible one.

**What the gate does not cover.** WCAG 1.4.11 (non-text contrast, 3:1) has no
axe rule, so the gate is silent on it by construction — that silence is not a
pass. The board's non-text boundaries (control borders, the drop-target
outline, dialog edges) are pinned instead by unit assertions on the rendered
CSS in `cli/src/board.test.ts` ("renderBoardHtml non-text contrast"), which
also forbid opacity fades as a state cue: a fade composites every descendant
against the surface below it (measured 1.5-2.7:1). If you introduce a new
control, surface or state indicator, add its boundary pair to that test —
`npm test` is the 1.4.11 gate
([task-board-non-text-contrast-and-drag-affordance](ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-non-text-contrast-and-drag-affordance.md)).

## Propose schema / convention changes

1. Create a work item in the tracker (`arggon create task "<title>" --parent <story-id>`) describing the change and why (agents + humans must share one rule).
2. Update **`ArggonManager/docs/convention.md`** in the same PR as any CLI/validate behavior that depends on it.
3. Update sample the tracker and `templates/` when the change affects them.
4. Breaking changes need an ADR under `ArggonManager/docs/adr/` and a bump of the tracker `.convention.yml` `version` when applicable.
5. Do **not** invent unofficial frontmatter keys outside the reserved `x-*` / `extensions` rules in the convention.

## Claim work

Follow claim rules in the convention: for `story` / `task` / `bug`, `in_progress` requires an `assignee`. Prefer claiming via the CLI when those commands exist; until then, edit frontmatter + open a PR.

## License

MIT — see [LICENSE](LICENSE).
