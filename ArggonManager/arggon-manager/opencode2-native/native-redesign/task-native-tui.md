---
type: task
status: in_progress
id: task-native-tui
title: TUI board and status panels
assignee: Arggon
branch: feat/task-native-tui
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-21"
claimed_at: "2026-09-21T13:00:37.264Z"
depends_on: [task-native-permissions-worktrees]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-tui
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-tui.md
  Leaves live only under a story. id is the filename stem: task-native-tui.
  CLI `arggon create task native-tui` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI board and status panels (W5)

## Context

W5 of `plan-native-first-011`. Register board/status panels and routes through the CLI/TUI plugin API (`session.panel`, sidebar slots) with commands to open them; item status appears in the sidebar. The static HTML board stays as an optional artifact.

## Acceptance

- [ ] The board/status panel opens from a command and renders the current tree.
- [ ] Plugin loads clean; no session-startup regressions.
- [ ] TUI smoke checklist completed (open/close/fullscreen, narrow terminal).
- [ ] No context-budget regression from panel registration.

## Notes

- Depends on W2; web console is out of scope for this wave.

### 2026-09-21 @Arggon
W5 evidence (task-native-tui) — branch `feat/task-native-tui`, PR #378 (draft).

## What landed

- `opencode/plugins/arggon/board.ts` (new): pure, kernel-backed display surface —
  `boardSnapshot()` (`findTasksDir` → `loadItems` → kernel `openDependencies` /
  `runNext`), cycle-safe tree flattening, plain-text panel/sidebar renderers with
  width clipping and `sanitizeHumanTextUncapped` escaping. Never throws: no
  tracker → an error snapshot the panel renders; never writes.
- `opencode/plugins/arggon/tui.tsx` (new): the TUI entry OpenCode discovers
  beside `index.ts`. `session.panel` contribution `arggon.board` (tree, status
  glyphs, `⌫deps`, active item, kernel `next`), `sidebar.content` status line,
  command `arggon.board.open` (slash `/arggon-board`, palette, `ctrl+g`), panel
  keys `esc`/`f`/`r`. All feature-detected + failure-isolated; `panel.open`
  returning `false` outside a session becomes a toast.
- Bundle/init: the emitted bundle forwards the entry's named value exports so
  the TUI entry can `import … from "./index.ts"`; `init` vendors `tui.tsx` with
  the generated marker + `x-generated` provenance; `.gitignore` covers the
  derived copy; typecheck gate moved to `cli/tsconfig.plugin.json` (strict +
  `paths` → `lib/src/index.ts`, build-independent).
- Tests: `board.test.ts`, `tui.test.ts` (+ `test/tui-runtime-stub.ts`),
  extended `bundle.test.ts`, init/seam/pack assertions.

## Acceptance checklist — status

- [x] Panel opens from a command and renders the current tree — `npm run smoke:tui`
      (init → 4-item tree → plugin list → API session → PTY `script` → types
      `/arggon-board`) asserts the captured terminal contains
      `arggon board · 4 item(s) · next: …` + `· T task-board-task — Board task`.
- [x] Plugin loads clean; no session-startup regressions — smoke:tui (no
      `failed to load plugin … argon`), suite green, session/startup scenarios in
      `smoke:opencode` unaffected.
- [x] TUI smoke checklist completed — manual PTY runs on 2.0.12: open
      (slash/palette/`ctrl+g` in-session); `esc` closes and restores the session
      view; `f` toggles full-screen (header moves 2;61 → 1;1); 60×20 stays
      full-screen, clips lines, no crash; sidebar `arggon ▶ task-board-task todo` at
      200 cols; branch (`feat/<id>`) and `ARGON_ITEM` both resolve the active item;
      home screen toasts "open a session first". Documented in
      `ArggonManager/docs/opencode2.md` § TUI board and status.
- [x] No context-budget regression — `context:report --strict` "all bounds
      pass"; before/after byte-identical (AGENTS.md 2,005 B, native defs 12,182 B,
      MCP 10,507 B, item block ≤1,024 B). Only `doctor.initTreeBytes` moves
      (411,370 → 434,227 B): on-disk vendored seam, not a model-context surface.

## Gates (worktree)

- `npm test` → 1438 passed (88 files)
- `npm run lint` → clean
- `npm run build` → clean
- `npm run check:plugin` → clean (bundle staged; rebuild byte-identical)
- `npm run arggon -- validate` → ok (0 warnings, v5)
- `npm run arggon -- spec validate` → ok (18 docs)
- `npm run smoke:tui` → passed (11/11 checks)
- `npm run context:report -- --strict` → all bounds pass

## Findings reported to the coordinator (not fixed here)

1. `smoke:opencode` W4 permissions scenario fails `the reviewer's shell gate
denies git push` in two independent runs: the reviewer model _declines_ to
   run `git push origin main` (the fixture has no `origin`), so no permission
   denial is emitted. Transcripts:
   `/tmp/arggon-smoke-permissions-X9AAsP/.smoke-evidence/` and
   `/tmp/arggon-smoke-permissions-bwDBUr/.smoke-evidence/` ("NOT RUN
   (declined)"). Not W5-related (no config/agent/permission change in this PR);
   candidate follow-up: plant an `origin` remote so the attempt reaches the
   shell gate.
2. Runtime drift: probes ran on the local OpenCode **2.0.12** while the playbook
   pins 2.0.10. The W5 surfaces are documented 2.0.x and feature-detected; the
   pin/A-B re-probe refresh is a coordinator call (noted in the playbook).
