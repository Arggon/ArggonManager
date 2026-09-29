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

- [ ] Add an exact/dev-only `@axe-core/playwright` dependency compatible with the pinned Playwright version; it must not enter production dependencies or the published package.
- [ ] Run AxeBuilder against the real served board in the existing `@smoke` Chromium lane after the page is ready and before the interaction/round-trip assertions complete.
- [ ] Assert WCAG-tagged automated checks with a stable, reviewed policy: no unexplained exclusions, disable-rules, or blanket exclusions; any accepted exception records the exact rule, reason, and owner.
- [ ] Fix only accessibility defects exposed on the current smoke surface or file linked follow-ups before merge; preserve the existing card match, status move, persistence, TUI, and live behavior.
- [ ] Keep the lane Chromium-only, one-worker, and deterministic on CI; no hosted accessibility service or personal browser profile.
- [ ] Update contributor/CI/testing documentation with the exact local and CI commands and failure remediation.
- [ ] Real-browser smoke evidence plus `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npx playwright test --grep @smoke`, and `arggon validate` are green.

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

| type | before | ratio | after | ratio |
| --- | --- | --- | --- | --- |
| initiative | `#6366f1` | 4.47 | `#6264ed` | 4.60 |
| epic | `#8b5cf6` | 4.23 | `#8458ea` | 4.60 |
| story | `#0ea5e9` | 2.77 | `#0b7cb0` | 4.64 |
| task | `#10b981` | 2.54 | `#0c855d` | 4.64 |
| bug | `#ef4444` | 3.76 | `#d53d3d` | 4.60 |

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
