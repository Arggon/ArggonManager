---
type: task
status: in_progress
id: task-axe-core-browser-ci
title: Add @axe-core/playwright to the existing browser CI lane
assignee: Arggon
branch: feat/task-axe-core-browser-ci
parent: ui-foundation
labels: [playwright, accessibility, ci, ui]
priority: p2
created: "2026-09-24"
updated: "2026-09-29"
claimed_at: "2026-09-29T01:43:14.629Z"
depends_on: [task-ast-grep-structural-rules]
worktree_path: /home/arggon/Projects/ArggonManager-task-axe-core-browser-ci
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-axe-core-browser-ci.md
  Leaves live only under a story. id is the filename stem: task-axe-core-browser-ci.
  CLI `arggon create task axe-core-browser-ci` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Add @axe-core/playwright to the existing browser CI lane

## Context

Add `@axe-core/playwright` to the existing Playwright Test browser lane so common accessibility defects block CI on the real `arggon board --serve` surface. Keep the check deterministic and dev-only; do not add a second browser runner or runtime UI dependency.

## Acceptance

- [x] Add an exact/dev-only `@axe-core/playwright` dependency compatible with the pinned Playwright version; it must not enter production dependencies or the published package.
      — `4.13.0` pinned exact in `devDependencies` (peer `playwright-core >= 1.0.0`; the lane's pinned `@playwright/test` is 1.63.0). `dependencies` unchanged; both new lock nodes marked `"dev": true`; `npm pack --dry-run` → 109 files with no axe/playwright/`e2e` path.
- [x] Run AxeBuilder against the real served board in the existing `@smoke` Chromium lane after the page is ready and before the interaction/round-trip assertions complete.
      — One scan in `renders one card per tracker item`, right after the existing `h1` board-load assertion (the readiness signal reused, no sleep), before the card-parity and round-trip tests. No second spec, no second runner, no workflow change.
- [x] Assert WCAG-tagged automated checks with a stable, reviewed policy: no unexplained exclusions, disable-rules, or blanket exclusions; any accepted exception records the exact rule, reason, and owner.
      — `withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"])`, asserted via a strict `toEqual([])`. Zero `disableRules`/`exclude`/`include`/narrowing; **zero accepted exceptions**. The exception rule (rule id + reason + owner at the call site, plus both docs) is written into the spec, `CONTRIBUTING.md` and `ArggonManager/docs/engineering.md`.
- [x] Fix only accessibility defects exposed on the current smoke surface or file linked follow-ups before merge; preserve the existing card match, status move, persistence, TUI, and live behavior.
      — The first scan reported one rule, `color-contrast` (wcag2aa), 35 nodes, two root causes; both fixed in `cli/src/board.ts` (badge/muted palette darkened; `.card.dep-blocked` blanket `opacity: 0.55` replaced by a muted surface). Fixed `bug` and the latent `.empty`/`.mgroup-head.none`/`.pr.draft` greys too. Filed instead of excluded: `task-axe-board-drawer-and-lens-coverage`, `task-board-non-text-contrast-and-drag-affordance`. Card match, status move, persistence, the TUI frame check and the live-reload test are unchanged and green.
- [x] Keep the lane Chromium-only, one-worker, and deterministic on CI; no hosted accessibility service or personal browser profile.
      — `playwright.config.ts` untouched (Chromium project, `workers: 1`, bounded retries). axe runs in-process against the local fixture server only: no hosted service, no network beyond localhost, no personal profile.
- [x] Update contributor/CI/testing documentation with the exact local and CI commands and failure remediation.
      — `CONTRIBUTING.md` § UI smoke tests (commands, tag set, policy, and a numbered failure-remediation procedure) and `ArggonManager/docs/engineering.md` § Smoke test (new a11y bullet with what the gate does _not_ claim) + the testing-expectations table row.
- [x] Real-browser smoke evidence plus `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npx playwright test --grep @smoke`, and `arggon validate` are green.
      — Local: 9/9 in real Chromium; `npm test` 103 files / 1702 tests; lint, build, `check:plugin`, `lint:structure`, `test:structure` clean; `validate --json` `ok:true`. CI on PR #435: `cli` pass, `ui-smoke` pass (9/9 @smoke + TUI frame), `tasks-validate` pass. The gate was also proven to **fail** by reverting one colour (see the item comment).

## Notes

### 2026-09-29 @Arggon

## Evidence — @axe-core/playwright in the `@smoke` lane

**Dependency.** `@axe-core/playwright` pinned **exact at 4.13.0** as a
`devDependency` (`npm install --save-dev --save-exact @axe-core/playwright@4.13.0`).
Compatibility: its only peer is `playwright-core >= 1.0.0`; the lane's pinned
`@playwright/test` is **1.63.0** (`node -p "require('@playwright/test/package.json').version"`).

**Dev-only / not in the tarball — how it was checked**

1. `dependencies` unchanged: `{"@arggondev/lib":"^0.4.0","commander":"^13.1.0"}`;
   `peerDependencies` and `optionalDependencies` absent. The entry is only under
   `devDependencies`.
2. `package-lock.json` records both new nodes as `"dev": true`
   (`@axe-core/playwright@4.13.0` and its `axe-core@4.13.0` dependency).
3. `npm pack --dry-run --json` → `arggon-manager-0.4.0.tgz`, **109 files, and
   zero paths matching `axe|playwright|^e2e/`** — no `e2e/` spec, no dev
   package source.
4. Extracted the real tarball (`npm pack` + `tar -xzf`): the published
   `package.json` lists `@axe-core/playwright` under `devDependencies` (npm
   always ships the full manifest; consumers never install devDeps) — identical
   to the pre-existing `@playwright/test` line. The only other `axe` string
   matches in the tarball are the **branch name** in `dist/build-info.json`
   (`feat/task-axe-core-browser-ci`) and **code comments** in `dist/board.js`.

**AxeBuilder placement and the readiness signal reused.** One scan, inside the
existing test `renders one card per tracker item`, immediately after
`await expect(page.locator("h1")).toContainText("arggon board")` — the lane's
**existing** board-load readiness signal, reused, not a new sleep — and before
the card-parity and the `a status move round-trips through the UI and persists`
tests run, so a failure points at the static surface. The scan lives in an
`axeScan(page)` helper called from that one test; no second spec file, no second
runner, no new job.

**Tag set asserted:** `["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]`
— every WCAG A/AA level axe automates, across all three WCAG versions it ships
rules for. AAA out of scope (almost nothing automated there); `best-practice` out
of scope (not a conformance level) and that decision is recorded. **No
`disableRules`, no `exclude`, no `include`, no narrowed rule list; zero accepted
exceptions.** The exception rule (exact rule id + reason + owner, in a call-site
comment and in both docs) is written into the spec, `CONTRIBUTING.md` and
`ArggonManager/docs/engineering.md`.

## Every violation found, and what was done with it

The first scan reported exactly **one** rule — `color-contrast` (wcag2aa),
**35 nodes**, from two root causes. Nothing was excluded.

**1. Type badge fills — white 10px `.type` text (5 values, all failing).** Fixed,
hues unchanged, only lightness darkened to clear AA's 4.5:1:

| type       | before    | ratio | after     | ratio |
| ---------- | --------- | ----- | --------- | ----- |
| initiative | `#6366f1` | 4.47  | `#6264ed` | 4.60  |
| epic       | `#8b5cf6` | 4.23  | `#8458ea` | 4.60  |
| story      | `#0ea5e9` | 2.77  | `#0b7cb0` | 4.64  |
| task       | `#10b981` | 2.54  | `#0c855d` | 4.64  |
| bug        | `#ef4444` | 3.76  | `#d53d3d` | 4.60  |

`bug` is not in the smoke fixture, but it is the same rule on the same rendered
element, so it was fixed rather than left to fail a future lane.

**2. Muted greys `#a0a6ad` / `#8c919a` — 2.46 and 3.17:1 on the card. Fixed.**
Collapsed into one value `#666a6f` that clears the threshold on **all three**
surfaces where that grey appears (card 5.45, column 4.61, dep-blocked card 5.08).
Applied to `.assignee.unassigned`, `.pr.nopr`, `.pr.draft`, `.column .empty`,
`.mgroup-head.none`. `.pr.draft`, `.column .empty` and `.mgroup-head.none` are
latent (no draft PR / empty column in today's fixture) — fixed anyway, because
leaving known-failing values behind a new gate is a false green.

**3. `.card.dep-blocked { opacity: 0.55 }` — 13 of the 35 nodes. Fixed.** A
blanket `opacity` composites every descendant against the column: the title, id,
parent, branch, priority chip, assignee, PR badge and labels all fell to
1.5–2.7:1. The de-emphasis cue is preserved as a muted surface
(`background: #f6f7f9`) instead, so the text stays legible (title
`#59636e` on `#f6f7f9` = 5.70:1). **This is a visible change** and is called out
in the PR. This is a genuine WCAG 1.4.3 failure on the surface the lane already
renders, i.e. the carve-out the item allows — not axe-driven CSS churn.

**4. `.column.over` drop-target outline `#8c919a` → `#666a6f` (2.68 → 4.61:1).**
Not axe-reported (WCAG 1.4.11 non-text contrast is a manual check), but it is the
same value, the same stylesheet, and it is the only cue that a column will accept
a drop. Fixed for consistency; disclosed here as outside the automated findings.

## Filed, not fixed (no exclusions)

- **`task-axe-board-drawer-and-lens-coverage`** (`ui-foundation`) — scan the
  detail drawer, the `file://` static export and the lens/filtered states, each
  with its own deterministic readiness signal; add a fixture that renders an
  **empty column** so fix 2's `.empty` change is actually asserted; and decide
  the unasserted `region` best-practice finding (the filter bar — label, input,
  count — sits outside any landmark; 3 nodes). Explicitly: do not resolve it by
  widening the tag set without fixing what it reports.
- **`task-board-non-text-contrast-and-drag-affordance`** (`ui-web-board-v2`) —
  WCAG 1.4.11 non-text contrast (axe automates none of it: the count pill, the
  lens chips, the drawer focus indicator) and a design call on
  `.card.dragging { opacity: 0.5 }`, which is transient, invisible to a scan that
  runs on the ready page, and arguably wrong for a keyboard/screen-reader user
  for whom the card is not being moved at all.

## One reported finding I deliberately did NOT file

An exploratory scan reported `label` (wcag2a) on the drawer's read-only
checkboxes. **It did not reproduce**: 10 further scans (5 independent runs ×
{scan immediately after the drawer opens, scan after the rows are present}) all
reported only `color-contrast`, and a DOM dump shows each checkbox wrapped in a
`<label class="drawer-check">` with `labels.length === 1` and label text
`done row` / `open row`. The source confirms the input is always created inside
that label. So there is no defect to track; filing one would be noise. The
drawer is still worth gating, which the follow-up above covers.

## Real-browser evidence

Command (worktree; see the caveat below for the invocation):

```
npm run build
npx playwright test --grep @smoke
```

Observed: **9 passed (6.1s)**, real installed Chromium
(`~/.cache/ms-playwright/chromium-*` present; no browser was installed for this
work). No test was skipped, retried or filtered.

```
✓  1 [chromium] › e2e/board.smoke.spec.ts:339:3 › @smoke board --serve › renders one card per tracker item (519ms)
✓  2 … › a saved lens filters the board, shrinks the column and round-trips through the URL (186ms)
✓  3 … › free text narrows id/title and survives a reload (186ms)
✓  4 … › the static export filters offline through the same URL hash (724ms)
✓  5 … › a status move round-trips through the UI and persists (275ms)
✓  6 … › opens the item detail drawer (Enter), renders the checklist and deps, Esc returns focus (235ms)
✓  7 … › opens the drawer from a filtered view; Esc closes it before the filter's clear (166ms)
✓  8 … › renders the live-overlay PR badge as a link (and refuses non-http URLs) (197ms)
✓  9 … › a live reload that removes the item closes the drawer gracefully (422ms)
9 passed (6.1s)
```

**Negative test — the gate is proven to bite, not just to pass.** One colour
(`.assignee.unassigned`) was reverted to `#a0a6ad` in `dist/board.js` and the
lane re-run. Expected: failure. Observed: test 1 failed, 8 passed, with

```
Error: axe found WCAG-tagged automated accessibility violations on the ready board.
Fix the board (contrast, names, roles) or file a follow-up item — do not exclude the rule.
  color-contrast (serious; wcag2aa, wcag143): Elements must meet minimum color contrast ratio thresholds
  div[data-id="board-smoke"] > .assignee.unassigned
    <div class="assignee unassigned">unassigned</div>
  … (9 selectors)
  https://dequeuniversity.com/rules/axe/4.13/color-contrast?application=playwright
```

`dist/board.js` was then restored and the tree rebuilt.

**Invocation caveat (pre-existing, not introduced here).** In this prepared
worktree `node_modules` is a symlink farm to the primary install, so the
Playwright runner (reached through `.bin`) and the spec files (which resolve
`@playwright/test` through the worktree path) load **two** copies of the
Playwright module, and `npx playwright test` dies before running anything with
`Playwright Test did not expect test.describe() to be called here`. I confirmed
this on the **unmodified baseline** before touching the spec (9/9 with the
workaround below, 0/0 without). The workaround is to run the runner through
the worktree's own path with symlink preservation:

```
node --preserve-symlinks --preserve-symlinks-main node_modules/playwright/cli.js test --grep @smoke
```

Neither a normal checkout nor CI (where `npm ci` creates a real `node_modules`)
is affected, so nothing was changed in the repo for it. **The coordinator should
be aware**: any worker running the browser lane from a link-farm worktree needs
that invocation. This is a candidate for its own item under
`start-worktree-ergonomics`; I have not filed one, as it is outside this item's
scope and I did not want to grow the diff.

## Docs changed

- `CONTRIBUTING.md` § UI smoke tests — the axe bullet, the exact tag set, the
  no-exclusion policy, and a numbered **failure-remediation** procedure (read
  the rule id → reproduce with the same two commands → fix `cli/src/board.ts`,
  not the spec → file a task if the fix is bigger than the defect → never add a
  `disableRules` entry).
- `ArggonManager/docs/engineering.md` § Smoke test — a new "Accessibility
  (automated, in the same `ui-smoke` lane)" bullet with the tag set, the policy,
  and an explicit statement of what the gate does **not** claim (partial WCAG
  coverage, ready-board-only), plus the testing-expectations table row.

## Other gates

`npm test` 103 files / 1702 tests passed · `npm run lint` clean ·
`npm run build` clean · `npm run check:plugin` no bundle drift ·
`npm run lint:structure` clean · `npm run test:structure` 3 passed ·
`npm run arggon -- validate --json` → `{"ok":true,…,"errors":[],"warnings":[]}` ·
`npx prettier --check` clean on all six touched files.

PR: **#435** (draft) — https://github.com/Arggon/ArggonManager/pull/435

### handoff 2026-09-29 @Arggon — next: Review PR #435 (draft) and merge: axe is wired into the @smoke lane, the 35 color-contrast nodes are fixed, no rule is excluded

- branch: feat/task-axe-core-browser-ci
- open questions: is the dep-blocked muted-surface visual change acceptable?; browser lane needs --preserve-symlinks in link-farm worktrees - file under start-worktree-ergonomics?; is one axe scan on the ready page en…
### 2026-09-29 @Arggon-coordinator
## FINAL APPROVE — PR #435 (`1d72fcce`), p2

I ran the browser lane myself in both directions, because "axe passes" and "axe would catch a
regression" are different claims. **Merge authorized; this comment performs no merge and no
`done` flip.**

### I verified the gate bites
Reverting the muted greys in the **built** `dist/board.js` and re-running the lane:

| state | result |
| --- | --- |
| PR head | **9 passed** (6.1s) |
| all `#666a6f` → `#a0a6ad` | **1 failed** — `color-contrast (serious; wcag2aa, wcag143)` with axe's remediation URL, 8 passed |
| restored | **9 passed**, `dist` byte-identical to the committed build |

Then a second, more interesting experiment: reverting **one** occurrence of `#666a6f` still gave
9 passed. That independently confirms the worker's claim that three of the five muted rules
(`.pr.draft`, `.column .empty`, `.mgroup-head.none`) are **latent on today's fixture** — no draft
PR, no empty column. The worker fixed them anyway, on the grounds that "known-failing values behind a
new gate are a false green." That is the correct call and my experiment is the proof: a future fixture
that renders a draft PR would have failed this gate for reasons nobody had fixed.

### Nothing was excluded to make it green — the point of the item
The first scan found 35 nodes from two root causes, and the disposition is what I actually reviewed:

1. **Type badge fills** (white 10px on the chip) — darkened, **hues unchanged**, each value driven until white clears 4.5:1 (initiative 4.47→4.60, epic 4.23→4.60, story 2.77→4.64, task 2.54→4.64, bug 3.76→4.60). `bug` is not in the fixture; fixing it anyway is the same discipline as above.
2. **Two failing muted greys** (`#a0a6ad` at 2.46:1, `#8c919a` at 3.17:1) collapsed into one `#666a6f` that clears the threshold on all three surfaces it appears on (card 5.45, column 4.61, dep-blocked 5.08) — with the three contrast ratios written into the source comment, so the next person does not re-derive them.
3. **`.card.dep-blocked { opacity: 0.55 }`** — 13 of the 35 nodes. This is the substantive one: a blanket `opacity` composited every descendant against the column and took the whole card to 1.5–2.7:1. Replaced with a muted surface, keeping the de-emphasis cue and the title legible at 5.70:1.
4. **`.column.over`** — **not** axe-reported (1.4.11 is manual), fixed for consistency and **disclosed as such** rather than presented as a caught violation. That distinction is the kind of thing that erodes trust in a report when left implicit.
5. **Zero** `disableRules`, `exclude`, `include` or `withRules()` narrowing, **zero accepted exceptions** — and the exception mechanism (rule id + why it is not a contributor-fixable defect + an owner, at the call site and in both docs) is written into the spec, `CONTRIBUTING.md` and `engineering.md` so it cannot be introduced quietly later.

Two findings were **filed as items rather than excluded**: `task-axe-board-drawer-and-lens-coverage`
(drawer, `file://` export, lens/empty-column states, the unasserted `region` rule) and
`task-board-non-text-contrast-and-drag-affordance` (1.4.11 non-text contrast, the transient
`.card.dragging` fade, which needs a design call and is correctly not decided here).

### Placement and policy
The scan sits inside the **existing** test, immediately after the lane's own readiness assertion
(`h1` contains "arggon board") and **before** the card-parity and round-trip tests — so a failure
points at the static surface rather than at post-interaction state, and no sleep was added. The tag
set is written out (`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`) rather than approximated by
`["wcag2a","wcag2aa"]`, precisely so a 2.1/2.2 AA rule cannot pass unreported; AAA and
`best-practice` are excluded **by a stated decision**, and `playwright.config.ts` and the workflow
are untouched — a new spec file, runner or browser install would have been scope creep.

### The visible UI change, reviewed on its merits
Acceptance box 4 requires the existing card match, status move, persistence, TUI and live behavior to
survive. They do (9/9, including the drawer, lens, static-export, live-reload and PR-badge cases), and
the TUI frame check passed in CI. The dep-blocked change *is* visible — flagged in the PR, not
buried — and it is a legitimate a11y fix rather than cosmetic churn: it replaces an unreadable
treatment with a legible one while keeping the de-emphasis signal.

### Dev-only, verified four ways
`dependencies` unchanged; both new lock nodes `"dev": true`; `npm pack --dry-run --json` → 109
files with **zero** paths matching `axe|playwright|^e2e/`; and the real tarball inspected — the
published `package.json` lists it under `devDependencies` (npm always ships the full manifest; the
pre-existing `@playwright/test` line is identical), with the only other `axe` matches being the
branch name in `build-info.json` and code comments. Exact pin `4.13.0`; sole peer
`playwright-core >= 1.0.0`, satisfied by the lane's `@playwright/test@1.63.0`.

### Two things the worker did not file, which I have
Both are real, both were disclosed honestly, and neither belongs in that diff:

1. **`bug-worktree-link-farm-breaks-playwright-runner` (p2, filed).** A worktree's `node_modules` link farm loads **two Playwright module instances** (runner via `.bin`, spec via the symlink), so the lane dies with `Playwright Test did not expect test.describe() to be called here`, and `node --preserve-symlinks --preserve-symlinks-main node_modules/playwright/cli.js test` is the workaround. I confirmed the 9-passed workaround run myself. p2 and not p3 because the review bar makes a real-browser drive **merge-blocking** for UI changes, and this removes that gate from every worktree-based reviewer — including me — while CI stays green, so it only ever bites humans. Fixing the link farm's interaction rather than shipping a wrapper is the point.
2. **`task-typecheck-e2e-specs` (p3, filed).** `e2e/` is in no tsconfig project, so the spec that just became a gate is never type-checked; Playwright transpiles without checking, so a type error in the spec would not fail the lane, it would just run. Filed with the A/B proof requirement, since the fast-check PR set that precedent.

### One judgment the worker got right by *not* filing
A `label` violation on the drawer checkboxes appeared in one exploratory scan and did not reproduce
in ten more; a DOM dump shows each checkbox is correctly wrapped. There is nothing to track, and
filing a non-reproducible finding would be noise. Recording it on the item is the right level.

### Gates
103 files / 1702 tests · `lint` · `build` · `check:plugin` · `lint:structure` 0 findings ·
`test:structure` 3 passed · `validate --json` `ok:true` · `@smoke` 9/9. CI `36511281849`
(`cli` 5m0s, `ui-smoke` 1m39s with 9/9 + the TUI frame) and `36511281761` (`tasks-validate`)
success on this head.
