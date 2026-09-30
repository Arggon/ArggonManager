---
type: task
status: in_progress
id: task-axe-board-drawer-and-lens-coverage
title: "Extend the axe gate to the drawer, static export and lens states"
assignee: Arggon
branch: feat/task-axe-board-drawer-and-lens-coverage
parent: ui-foundation
labels: [accessibility, playwright, ci, ui]
priority: p2
created: "2026-09-29"
updated: "2026-09-30"
claimed_at: "2026-09-30T20:49:25.638Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-axe-board-drawer-and-lens-coverage
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-axe-board-drawer-and-lens-coverage.md
  Leaves live only under a story. id is the filename stem: task-axe-board-drawer-and-lens-coverage.
  CLI `arggon create task axe-board-drawer-and-lens-coverage` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Extend the axe gate to the drawer, static export and lens states

## Context

`task-axe-core-browser-ci` put `@axe-core/playwright` in the existing `@smoke`
Chromium lane, but scoped the scan to the **ready served board** only — one scan,
gated on the spec's existing readiness signal, so the failure points at the static
surface. Three other surfaces the same lane already drives are unscanned, and one
`best-practice` finding was deliberately left unasserted.

Deliberately out of scope of the parent item, and the reason each is separate:

1. **The detail drawer** (`#board-drawer`). Its content is fetched from
   `/api/item` and built client-side, so it needs its own readiness signal
   (`.drawer-acceptance .drawer-check` reaching the expected count) — a scan
   bolted onto the existing drawer test would otherwise race the fetch. An
   exploratory scan with the drawer open reported **no** WCAG-tagged violation
   across 10 scans; the drawer's read-only acceptance checkboxes are wrapped in a
   `<label class="drawer-check">` (`labels.length === 1`), so the
   accessible-name path is sound. This item exists to make that **gated** rather
   than merely observed.
2. **The static export** (`arggon board --out`, served over `file://`). Same
   markup, but a separate document: a regression that only affects the export
   path would be caught here.
3. **Lens / filtered / free-text states.** Cards get `display: none`, group
   heads hide, and the `.empty` placeholder appears. The `.empty` and
   `mgroup-head.none` greys were darkened in the parent item _because_ the scan
   must stay green when a future fixture renders an empty column — but no test
   renders one today, so that fix is currently unverified by the gate.
4. **`region` (best-practice, not a WCAG conformance level):** the filter bar
   (`#board-filterbar`: the label, `#board-filter-input`, `#board-filter-count`)
   sits outside any landmark, so axe reports 3 nodes of "page content is not
   contained by landmarks". The parent item scoped its tag set to
   `wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa` and therefore does not assert it.
   This item must decide whether to widen the tag set (which would also pull in
   every other `best-practice` rule — a scope decision, not a one-liner) or to
   wrap the filter bar in a landmark. **Do not resolve it by adding
   `best-practice` to the tag list without fixing what it reports.**

## Acceptance

- [x] The drawer is scanned after a **deterministic** readiness signal for its
      async `/api/item` content (an `expect(...)` on a drawer element, never a
      sleep or a `networkidle` guess), still in the existing `@smoke` Chromium
      lane and still with the same WCAG A/AA tag set and the no-exclusion policy.
- [x] The static export (`file://`) and at least one filtered/lens state are
      scanned, each with its own readiness signal.
- [x] A fixture renders an **empty status column**, so the `.empty` /
      `mgroup-head.none` contrast fix carried by the parent item is actually
      asserted by the gate.
- [x] The `region` finding is resolved: either the filter bar is wrapped in a
      landmark, or the decision to leave `best-practice` out of the asserted tag
      set is recorded in the spec comment and in `CONTRIBUTING.md` with a reason.
      Widening the tag set without fixing the reported rules is not an option.
- [x] Any defect surfaced by the new scans is fixed in the board or filed as a
      linked item with the rule id, target selector and measured ratio — never
      excluded.
- [x] `npm run build`, `npm test`, `npm run lint`, `npm run check:plugin` and
      `npx playwright test --grep @smoke` are green, and
      `npm run arggon -- validate --json` reports `ok:true`.

### 2026-09-30 @Arggon
Evidence (PR #497, branch feat/task-axe-board-drawer-and-lens-coverage):

- Scans: the @smoke lane now runs axe at 5 states, each with a deterministic readiness signal — ready served page (plus an explicit expect that the fixture renders an EMPTY done column, so .empty contrast is asserted; the done column is empty at first-test time), the open detail drawer (scan placed right after the .drawer-acceptance .drawer-check toHaveCount(2) — the async /api/item readiness signal; no sleep, no networkidle), the static file:// export (after its h1), and the filtered/lens state (after the 1-of-N count; client-created .empty placeholders included).
- region finding: fixed, not excluded — #board-filterbar carries role=search aria-label='board filters' on every board (static + serve), pinned by a unit test in board.test.ts; the scan passes with zero exclusions. Recorded decision (best-practice stays out of the asserted tags; widen only after auditing its rule surface against every scanned state) now lives in the spec comment above AXE_WCAG_TAGS and CONTRIBUTING.md § Accessibility gate.
- No defect surfaced by the new scans: nothing to fix or file (drawer open over the scrim, drawer checkboxes, static document and filtered empties all clean under wcag2a/2aa/21a/21aa/22aa).
- Gates: npm run build ok, npm test 1852/1852, npm run lint clean, npm run check:plugin exit 0 (bundle unchanged — cli sources are not inlined), arggon validate --json ok:true, npx playwright test --grep @smoke 23/23 green on 4 of the last 5 runs and on the final run (12 total lane executions today).
- Out-of-scope-but-necessary, flagged for review: the merged sticky-header test raced the fixture creates' trailing debounced SSE reload ('Execution context was destroyed' mid-evaluate; observed failing 4x today across three branches, always green solo). The measurement now retries through that one navigation, bounded to 2 attempts (spec comment documents the race). No board code changed for it.
- Deviation note: the region acceptance arm chosen is BOTH — the landmark fix AND the recorded decision (spec comment + CONTRIBUTING) — because fixing region alone would leave the wider best-practice scope unrecorded.

### handoff 2026-09-30 @Arggon — next: Coordinator: review PR #497; if the sticky-header retry fix should be its own follow-up instead, split it before merge — the rest of the diff is scan/landmark only
- branch: feat/task-axe-board-drawer-and-lens-coverage
- open questions: Widen to best-practice? Needs an audit item per the recorded decision; region itself is fixed
