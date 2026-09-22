---
exploration_id: ui-improvements-012
title: "UI surfaces v2: web board, terminal TUI and OpenCode panel — improvements and features"
status: open
created: 2026-09-22
---

# Exploration: UI surfaces v2: web board, terminal TUI and OpenCode panel — improvements and features (ui-improvements-012)

Trigger: product-owner directive (2026-09-22) — "hora de mejorar las interfaces
de usuarios, TUI y web". Every number below was measured on `main` at
`c4a61b7c` on **2026-09-22**, against this repo's own tracker (288 items: 5
`todo`, 0 `in_progress`, 0 `blocked`, 281 `done`, 2 `cancelled`). Follow-up work
is filed under epic **`ui`** (stories `ui-web-board-v2`, `ui-tui-v2`,
`ui-native-panel-v2`, `ui-foundation`); ids are listed under Decision.

## Candidates

1. **In-place v2 on the existing surfaces** — vanilla JS/CSS inside the
   single-file board, raw-ANSI TUI, vendored OpenCode panel; reuse the kernel
   rules; zero new runtime dependencies.
2. **A `viewer` package with a component framework** (React/Vite or similar) —
   richer interactivity, but a new top-level package, a build pipeline and a
   framework choice, explicitly deferred by ADR 0002 until a v1 interactive
   viewer is actually needed.
3. **A TUI framework** (Ink / blessed / OpenTUI) — layout ergonomics, but ADR
   0001 keeps the CLI dependency-light; the renderer is ~460 lines with golden
   tests, and the OpenCode panel already covers rich terminal rendering.
4. **Server-rendered or hosted board** (multi-tenant, server state) — rejected
   by the viewer spike (#19 constraints) and the cheap-infra principle; no SaaS
   without an ADR.
5. **Do nothing** — the three surfaces are shipped and green, but the measured
   gaps below are user-visible and cheap to close.

## Criteria

1. **Adopter shape (high)** — `arggon init` trees are dependency-less; runtime
   deps must stay zero (browser tooling stays dev-only).
2. **Kernel-first semantics (high)** — filters, claims, transitions and
   dependency rules come from `@arggondev/lib`; no UI dialect.
3. **Measured user value (high)** — large-tracker usability; each item earns its
   wave by a reproducible defect or a missing capability.
4. **Reviewability (medium)** — golden tests plus the ADR 0008 smoke per change;
   work parallelizes per surface file.
5. **Maintenance cost (medium)** — three surfaces drift unless the derived
   view-model is shared; that drift is already measurable.
6. **Cost/effort (medium)** — prefer small increments that ship independently.

## Findings

### The three surfaces shipped, and all three stop at "display"

History (all `done`): `story-web-board` (static HTML, `--serve` live reload,
drag-and-drop through the kernel update path, PR review overlay),
`story-tui-board` (`arggon board --tui`, read-only kanban) and W5
`task-native-tui` (OpenCode V2 `session.panel` + sidebar + `/arggon-board`).

### Web board — measured with Playwright CLI 1.63.0 against `board --serve`

Reproduction: `npm run arggon -- board --serve --port 4179`, then
`playwright cli -s=x open http://127.0.0.1:4179 --browser chromium` and
`playwright cli -s=x eval "() => ({...})"`.

- **No controls at all:** 0 `input`/`select`/`textarea`/`button` elements in the
  served DOM. A 288-card board has no search, no filter, no grouping switch.
- **Not keyboard-usable:** 0 focusable cards (`tabindex`), 1 `aria-*` attribute
  in the whole DOM (`aria-live` on the toast). Status changes are HTML5
  drag-and-drop only — which also does not fire on touch devices, so phone
  users cannot move a card.
- **One long page:** body `scrollHeight` 41,752 px at a 1600x1000 viewport; the
  `done` column alone is 41,662 px (281 cards), `todo` 853 px. No collapse, no
  hide-`done`, no sticky headers.
- **State lost on every change:** the serve client runs `location.reload()` on
  the SSE `reload` event (`cli/src/board-serve.ts`), so scroll, filters and any
  open surface reset on any tracker write. There is no connection/offline
  indicator.
- **Light only:** `:root { color-scheme: light }`; no `prefers-color-scheme`
  branch, no density control.
- **Console noise:** `/favicon.ico` 404 is the only console error in a clean
  load; `POST /api/update` performs no Origin/Host validation (loopback-bound
  only).
- **Untapped kernel surface:** the CLI owns the filter language
  (`lib/src/filter.ts`; `list --filter`) and saved views (`x-views`); no web
  surface consumes either. The kernel also owns `show`/`loadItem` for bounded
  item reads — the board never shows an item body, checklist or comment tail.
- **Assets:** the static export is one self-contained file, 167 KB for 288
  items, zero runtime deps — a constraint to preserve, not a problem.

### CLI TUI — pty capture + pure-renderer proof

Reproduction: `script -qec "stty cols 160 rows 42; node_modules/.bin/tsx
cli/src/cli.ts board --tui" /dev/null` driven with arrow keys, plus a direct
`renderTui` harness.

- **The selection can leave the screen (defect).** `renderTui` renders body rows
  from index 0 (no scroll offset) and `clampTuiState` clamps to the column
  length, not the visible body height. Pure-render at 80x24 with 30 `todo`
  items: body rows = 21, `handleKey` accepts card index 25, the frame renders
  `task-demo-00`..`task-demo-20` and **not** `task-demo-25`. Live pty at
  160x42 on the `done` column (281 cards), `↓`x60: the last frame shows rows
  0..38 with **zero** body highlight sequences — the selected card is invisible
  and the footer gives no position. Filed as `bug-tui-selection-offscreen`.
- **No detail view:** Enter only prints the item path; body/checklist/deps
  require quitting.
- **Substring-only filter:** `/` matches id/title; the kernel filter language and
  `x-views` are unused. No sort/priority/ready lens; no file watcher (idle views
  are stale until the next keypress); arrows-only navigation, no help overlay.

### OpenCode V2 panel — source read (W5 surface) + existing smoke harness

- The panel body is `boardTreeLines`: header + counters + flat tree lines, a
  200-line display cap, no selection, no item detail. Keys: `esc`/`f`/`r` only.
- The sidebar status line is created on mount with no setter, so it never
  refreshes; the panel reloads on `r` only.
- Guards are good and must survive: corrupt trackers degrade to an error
  header, and the slot is crash-isolated (`npm run smoke:tui` proves it).

### Foundation gaps (cross-surface)

- Dependency-blocked derivation is implemented three times
  (`cli/src/board.ts`, `cli/src/tui.ts`, `opencode/plugins/arggon/board.ts`)
  while the kernel shares only `openDependencies`/`isReady`; v2 features will
  multiply the divergence.
- ADR 0008 tier 2 — the optional CI `@smoke` Playwright spec — was decided but
  never implemented; there is no permanent browser regression net.
- The review-time Playwright CLI path works well (this spike used it), so the
  missing piece is only the deterministic CI tier.

## Recommendation

**Candidate 1: in-place v2, no new dependencies, in small waves.** Keep ADR 0001
and ADR 0002 intact; spend the effort on the measured gaps instead of a stack
change.

Ordering the filed items by value per effort:

1. **Wave 0 — foundation (low risk):** `task-ui-shared-viewmodel`,
   `task-ui-browser-smoke-ci`. The view-model kills the three-way drift before
   v2 features land; the smoke gate makes every later wave cheaper to review.
2. **Wave 1 — p1, user-visible:** `bug-tui-selection-offscreen` (real defect),
   `task-board-filter-lenses` (biggest web win: 288 cards, no search today),
   `task-board-item-detail` (board becomes readable without leaving it),
   `task-board-keyboard-a11y` (keyboard/touch access + menu alternative).
3. **Wave 2 — p2:** `task-board-column-controls`,
   `task-board-live-reload-state`, `task-board-theme-density`,
   `task-tui-detail-pane`, `task-tui-filter-language`,
   `task-tui-sort-ready-lens`, `task-tui-live-refresh`,
   `task-native-panel-interaction`.
4. **Wave 3 — p3 polish:** `task-board-move-dialogs`,
   `task-board-progress-header`, `task-board-serve-hardening`,
   `task-tui-help-vim-keys`, `task-native-panel-refresh-filter`.
5. **Spec-first (deferred):** `task-tui-actions-parity` — terminal writes need a
   spec and the board's parity-guard pattern before code.

Trade-offs: the in-place plan keeps the adopter shape and review cost low, but
the board renderer keeps growing (697 lines today) and is a single file touched
by most web items — waves 2–3 must serialize on `cli/src/board.ts`. If the board
ever needs a real component model, the ADR path is a `viewer` package
superseding ADR 0002; this plan does not need it.

Losers: framework package (ADR + dependency weight the adopter trees do not
have), TUI framework (ADR 0001; the current renderer is small and golden-tested),
SaaS/hosted board (viewer spike + cheap-infra), do-nothing (measured defects).

## Decision

No ADR is required while the plan stays inside the existing packages (ADR 0001
and ADR 0002 hold). A component framework, a new `viewer` package or anything
that adds a runtime dependency would require the superseding ADR first.

Filed work (epic `ui`, parent `arggon-manager`, priority p2):

| Story                | Items                                                                                                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-web-board-v2`    | `task-board-filter-lenses` (p1), `task-board-item-detail` (p1), `task-board-keyboard-a11y` (p1), `task-board-column-controls` (p2), `task-board-live-reload-state` (p2), `task-board-theme-density` (p2), `task-board-move-dialogs` (p3), `task-board-progress-header` (p3), `task-board-serve-hardening` (p3) |
| `ui-tui-v2`          | `bug-tui-selection-offscreen` (p1), `task-tui-detail-pane` (p1), `task-tui-filter-language` (p2), `task-tui-sort-ready-lens` (p2), `task-tui-live-refresh` (p2), `task-tui-help-vim-keys` (p3), `task-tui-actions-parity` (p3, spec first)                                                                     |
| `ui-native-panel-v2` | `task-native-panel-interaction` (p2), `task-native-panel-refresh-filter` (p3)                                                                                                                                                                                                                                  |
| `ui-foundation`      | `task-ui-shared-viewmodel` (p2), `task-ui-browser-smoke-ci` (p2)                                                                                                                                                                                                                                               |

Related prior art: `exploration-smoke-ui-testing-006` (the Playwright two-tier
decision, ADR 0008) and `exploration-product-discovery-002` (ranked board/TUI
surfaces; the review surface and dependency visuals shipped — the rest of this
spike is the follow-through).
