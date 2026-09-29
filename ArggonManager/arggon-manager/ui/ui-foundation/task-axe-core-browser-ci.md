---
type: task
status: todo
id: task-axe-core-browser-ci
title: Add @axe-core/playwright to the existing browser CI lane
parent: ui-foundation
labels: [playwright, accessibility, ci, ui]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
depends_on: [task-ast-grep-structural-rules]
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

- [ ] Add an exact/dev-only `@axe-core/playwright` dependency compatible with the pinned Playwright version; it must not enter production dependencies or the published package.
- [ ] Run AxeBuilder against the real served board in the existing `@smoke` Chromium lane after the page is ready and before the interaction/round-trip assertions complete.
- [ ] Assert WCAG-tagged automated checks with a stable, reviewed policy: no unexplained exclusions, disable-rules, or blanket exclusions; any accepted exception records the exact rule, reason, and owner.
- [ ] Fix only accessibility defects exposed on the current smoke surface or file linked follow-ups before merge; preserve the existing card match, status move, persistence, TUI, and live behavior.
- [ ] Keep the lane Chromium-only, one-worker, and deterministic on CI; no hosted accessibility service or personal browser profile.
- [ ] Update contributor/CI/testing documentation with the exact local and CI commands and failure remediation.
- [ ] Real-browser smoke evidence plus `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npx playwright test --grep @smoke`, and `arggon validate` are green.

## Notes

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
