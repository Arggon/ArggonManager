---
type: bug
status: in_progress
id: bug-tsx-board-dead-script
title: tsx-rendered-board-dead-script
assignee: Arggon
branch: fix/bug-tsx-board-dead-script
parent: ci-stability
labels: []
priority: p1
created: "2026-09-30"
updated: "2026-09-30"
claimed_at: "2026-09-30T23:56:07.824Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-tsx-board-dead-script
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-tsx-board-dead-script.md
  Leaves live only under a story. id is the filename stem: bug-tsx-board-dead-script.
  CLI `arggon create bug tsx-board-dead-script` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# tsx-rendered-board-dead-script

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-30 @Arggon
### Context (found by the task-board-theme-density worker; verified by the coordinator 2026-10-01)

Boards rendered through the **tsx path** (`npm run arggon -- board`, or `--serve` from source) embed a body script that dies on load: esbuild's `keepNames` transform (tsx) rewrites embedded function sources so `Function.toString()` carries `__name(...)` helper calls, but the helper is never defined in the page. Verified on this checkout: `npm run arggon -- board` → `board.html` contains **4 `__name(` calls, 0 definitions** (`applyBoardFilter`, `wireBoardColumns`, `wireBoardTheme`, …). The script throws `__name is not defined`, so **filter, drag, collapse, theme and density controls are dead** on that path (the `<head>` theme boot survives — separate script block).

Reproduced at `d55e0933` — **pre-existing**, not a theme-item regression. Invisible to every gate: vitest transforms via oxc (no `__name` in `Function.toString()`), and the smoke lane + CI drive `dist/cli.js` (tsc output, no `__name`). A reviewer driving the Playwright bar from source (`npm run arggon -- board --serve`) hits a dead page; from dist it passes.

### Fix shape (decide among)
- Render embedded board scripts from the **tsc-built dist output** rather than tsx-transformed sources;
- or **strip `__name(...)` calls / inject the helper** for toString-embedded sources at render time;
- or disable keepNames for the tsx run of the board path (esbuild/tsconfig knob) — verify the page script then round-trips.
Plus a **gate**: an e2e/unit assertion that the rendered page script contains no unresolved `__name` references (and a smoke leg driving the tsx path), so the class cannot return silently.

### Acceptance checklist
- [ ] Root cause confirmed (which transform injects `__name` and why toString carries it) and the chosen fix recorded.
- [ ] `npm run arggon -- board` output contains zero `__name(` references and every control works in a real browser (Playwright drive, expected vs observed).
- [ ] `npm run arggon -- board --serve` interactivity verified the same way.
- [ ] Regression gate added (rendered-script assertion + a tsx-path smoke leg) so it cannot return.
- [ ] Gates: full suite, lint, build, check:plugin, validate; README unaffected (dist path unchanged).

(Note: filed under `ecosystem-ops/ci-stability` because the owning `ui` containers are closed; it is a board render-path defect.)
