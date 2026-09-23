---
type: task
status: done
id: task-board-filter-lenses
title: "Web board filter lenses: search, saved x-views and URL state"
assignee: Arggon
branch: feat/task-board-filter-lenses
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-23"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-filter-lenses
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-filter-lenses.md
  Leaves live only under a story. id is the filename stem: task-board-filter-lenses.
  CLI `arggon create task board-filter-lenses` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board filter lenses: search, saved x-views and URL state

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The board renders every item (288 here) with no way to narrow the view: the served page has 0 input/select/button elements, and the done column alone is 41,662 px tall (281 cards). Meanwhile the CLI owns a filter language (`lib/src/filter.ts`, `list --filter`, `x-views` saved views) that no UI surface consumes. This is the single highest-leverage web-board improvement: it makes large trackers usable and reuses the kernel's semantics instead of inventing a board dialect (viewer-spike §5).

## Acceptance

- [ ] A filter/search control in the board (static export included, no runtime deps): free text on id/title plus predicates for `type`, `status`, `label`, `assignee`, `priority` and ancestor — semantics kept 1:1 with the kernel filter parser, with a documented supported subset and tests that prove the parity
- [ ] Saved views from the tracker `x-views` render as lens chips (name + expression in the tooltip); `@me` resolves like the CLI
- [ ] The active lens/filter is reflected in the URL hash and survives reload/share/copy; clearing restores the full board; per-column counts reflect the filtered set
- [ ] No `x-views` in the tracker (or no server) degrades cleanly; static export unchanged when no filter is applied
- [ ] Unit tests for the client-side predicate mirror + a Playwright-CLI smoke (apply a lens, column shrinks, URL reflects it); README + docs/json-output.md updated

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Coordinator note (pre-claim, wave 1)

The shared view-model (task-ui-shared-viewmodel, merged in PR #400) is now available in @arggondev/lib: applyViewLens (kernel filter expression + status + readiness + sort), groupItemsBy, treeEntries, openDependencyIds, statusCounts. Two things before you claim:

1. task-ui-viewmodel-contract-deps is the dependency-shape enabler: the lens reads dependsOn (kernel shape) while the board works with contract items (depends_on). Pick the resolution there (accept both or a mapper) and consume it here — do not silently lose blocked-by:/ready semantics.
2. This item extends the @smoke spec from task-ui-browser-smoke-ci (merged in PR #401): add a filter case to e2e/board.smoke.spec.ts, keeping the existing card-parity and move-round-trip cases green.

### 2026-09-23 @ses_f346f75d6ffe4HZG1eZrsa7E8i
## Wave 1 evidence — task-board-filter-lenses (PR #406, head `0a70e6fc`)

**Delivered:** client-side filter/search lens for `arggon board` (static export + `--serve`, single file, zero runtime deps): filter box + one chip per tracker `x-views` view (name + `name: expression` tooltip), URL hash state (`#filter=<expr>`), filtered per-column counts, empty group-head handling. `runBoard`/`startBoardServer` read `x-views` through the kernel; `applyBoardFilter` is stringified into the page (`evaluateDrop` pattern, no module refs/template literals). No `lib/**`, no TUI, no new CLI flags, no JSON contract change.

**Claim-commit note (bug-native-start-worktree-no-install):** `start --worktree` skipped the claim commit (`tsx: command not found`, fresh worktree). Fixed with `npm ci` + manual `chore(tasks): started task-board-filter-lenses` (`207ef781`); branch/claim recorded correctly.

### Supported-subset table (extracted from the tests)

| Expression | Board v1 | Kernel parity proof |
| --- | --- | --- |
| free text (`login`, `"login flow"`, multi-token AND) | yes | shared `visibleItems` helper |
| `type:`, `status:` (enum-validated) | yes | `runList` on a real tracker |
| `label:`, `assignee:` (incl. `@me`) | yes | `runList` (resolveMe injected) |
| `priority:` (`none` = unset) | yes | `runList` |
| `ancestor:` (chain only, cycle-safe, not self) | yes | `runList` |
| `!` negation + quoting/quote/empty-value errors | yes | `parseFilter`/`runList` |
| `parent:`, `depends-on:`, `blocked-by:`, readiness | **refused in v1** | explicit divergence test (kernel accepts; board errors pointing at `arggon list --filter`) — contract `depends_on` vs kernel `dependsOn` stays owned by task-ui-viewmodel-contract-deps |

### Unit + parity (commands run)

- `npx vitest run cli/src/board.test.ts` → **52 passed** (16 new: 9 `applyBoardFilter`, 5 render/escape, 2 `runBoard` x-views).
- `npx vitest run cli/src/board-parity.test.ts` → **13 passed** (6 new: embedded source === TS source, vm-sandbox table, TS === `runList` over 19 expressions, free text === `visibleItems`, kernel-only refusal divergence, malformed refusal parity).
- `npm test` → **95 files / 1555 tests passed**; `npm run lint` clean; `npm run build` clean; `npm run check:plugin` no drift; `npm run arggon -- validate --json` → `ok:true`, 0 warnings; `npm run smoke:tui-board` passed.

### Real-browser drive (Playwright/Chromium, `board --serve` on THIS tracker: 316 cards)

| Step | Expected | Observed |
| --- | --- | --- |
| `type:bug status:todo` | `list --filter` count = 4 | 4 visible, todo column count `4`, counter `4 of 316 item(s)`, URL `#filter=type%3Abug%20status%3Atodo`, done column 44,609px → 87px |
| reload (share/copy) | input + filter restored | input `type:bug status:todo`, same counts |
| `parent:ui-web-board-v2` | refused, board intact | error shown (pointer to `arggon list --filter`), 316 visible |
| clear | full board, hash dropped | 316 visible, URL has no `filter=`, counter `316 item(s)` |
| `--group-by story` + `label:smoke` (fixture) | only matching group head | 5 heads → 1 visible head (`⚑ entries`), clear restores 5 |

`npx playwright test --grep @smoke` → **5 passed** (3 new: saved lens + column shrink + URL round-trip + clear; free text + reload; offline static export via `file://`; the pre-existing card-parity and move-round-trip cases stay green).

### Saved x-views in the static export (fixture probe)

- Fixture WITH `x-views` (`smoke: "label:smoke"`, `open: "status:todo"`): static `board.html` contains `<button class="lens" data-name="smoke" data-filter="label:smoke" title="smoke: label:smoke">smoke</button>` (+ `open`); browser: chips `["smoke","open"]`, tooltips `["smoke: label:smoke","open: status:todo"]`, click smoke → 1 visible (`task-board-filter-task`), `#filter=label%3Asmoke`, reload → 1 visible + active chip. `mine: "assignee:@me"` → `task-plain-task`, identical to `arggon list --view mine` (BOARD_ME baked `"Arggon"` from gh).
- Fixture WITHOUT `x-views` (this repo): static export has **0** chips / no `id="board-lenses"`, filter box + all cards intact; malformed `x-views` also degrades to no chips (unit-tested).

### Open questions

1. `parent:` is shape-light on contract items and could join v1 cheaply — left out deliberately per scope; the refusal message points to `arggon list --filter`.
2. `assignee:@me` resolves at generation time (env → `gh api user`, like `runList`); a board generated without either shows the loud CLI error when applied, never a silent empty match.
3. Chips/hash keep the raw `@me` expression; the baked login is per generated file — sharing the HTML shares that resolution by design (documented).

### handoff 2026-09-23 @ses_f346f75d6ffe4HZG1eZrsa7E8i (session: ses_f346f75d6ffe4HZG1eZrsa7E8i) — next: Review PR #406 (CI green: cli, ui-smoke, tasks-validate) on head 0a70e6fc; drive board --serve and click a lens chip; merge (not squash) and rebase sibling wave-1 PRs.
- branch: feat/task-board-filter-lenses
- open questions: parent: could join v1 cheaply (deliberately excluded); typed assignee:@me needs env/gh at generation time; @me resolution is baked per generated file by design.

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Coordinator review — PASS (lead architect) + merge verification

PR #406 (rebase-merged; auto-done #409 marked this item done).

**Independent verification.** Focused suites: 77 passed (board 52 + parity 13 + serve 12); `npx playwright test --grep @smoke` → **5/5 passed** in a real Chromium, including the offline static-export filter case. Code review: `applyBoardFilter` is a self-contained mirror stringified into the page (evaluateDrop pattern); the parity suite proves embedded source === TS source === `runList` over the expression table and refuses malformed expressions; the kernel-only dependency predicates are refused with a kernel pointer (documented divergence, parity-asserted); `x-views` + `@me` are generation-time reads (the static export has no server); serve re-reads views per render and degrades on malformed config; URL hash state; no `lib/**`, no plugin bundle, no new CLI flags, no JSON field changes; README + json-output board section updated.

**Acceptance verified:** filter/search control in the static export and serve; saved views as lens chips; URL round-trip (share/reload/copy) and clean clear; per-column counts follow the filtered set; clean degradation without `x-views`; tests + browser smoke; docs. The item's pre-claim note (only the documented non-dependency subset) was honored.

**Note:** the worker's evidence comments had landed on the primary checkout (not the branch) and would have been lost by the rebase-merge; recovered into main as `b16bf0a3` before this verdict.

Follow-up filed: `task-board-filter-dep-predicates` (p3) — enable `parent:`, `depends-on:`, `blocked-by:` and readiness now that the dual-shape lens is merged.
