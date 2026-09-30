---
type: task
status: in_progress
id: task-board-keyboard-a11y
title: "Web board keyboard and accessibility: focus, move menu, ARIA"
assignee: Arggon
branch: feat/task-board-keyboard-a11y
parent: ui-web-board-v2
labels: [viewer, board, a11y, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T13:07:42.710Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-keyboard-a11y
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-keyboard-a11y.md
  Leaves live only under a story. id is the filename stem: task-board-keyboard-a11y.
  CLI `arggon create task board-keyboard-a11y` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board keyboard and accessibility: focus, move menu, ARIA

## Context

<!-- Why this task exists. -->

## Acceptance


## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Measured on 2026-09-22 against `board --serve`: 0 focusable cards, 1 aria attribute in the whole DOM (aria-live on the toast), no non-drag path to change a status. HTML5 drag-and-drop also does not fire on touch devices, so phone/tablet users cannot move a card at all. The board is the repo's review surface; keyboard-only users should be able to review and act.

## Acceptance

- [x] Cards are reachable and navigable by keyboard (roving tabindex or equivalent, visible focus ring, arrow/Home/End across columns), with column landmarks and headings
- [x] A keyboard/touch alternative to drag: a card action menu (key + tap/click affordance) offering only legal transitions and running the same `evaluateDrop` parity path, including the claim and blocked-reason requirements
- [x] ARIA roles/labels for board, columns and cards; the toast is a live status region; dialogs/drawer manage focus and restore it on close; no duplicate ids
- [x] Documented touch fallback (DnD limitation) with a Playwright-CLI mobile-emulation smoke
- [x] Tests + Playwright-CLI smoke: keyboard-only status move round-trips and persists (verified with `arggon show`)

### 2026-09-30 @Arggon
verdict evidence (implementation, task-board-keyboard-a11y): all five acceptance boxes verified in the worktree before commit 1a25996e.

Gates: npm test 1780 passed (107 files); npm run lint clean; npm run build clean (tsc + typecheck + plugin); npx playwright test --grep @smoke 13 passed, run twice; arggon validate --json ok:true. axe @smoke scan (wcag2a/2aa/21a/21aa/22aa) green with zero disableRules/exclude — the new move button, menu dialog, landmarks and labels all pass it.

Expected vs observed (all via the @smoke spec on a temp fixture served from dist/cli.js):
- keyboard-only move: 'm' on focused cancelled card -> menu offers exactly 'move to todo' -> Enter -> card in todo column, toast 'task-board-detail-done-dep -> todo', focus restored to card, arggon show --json status 'todo' (persists).
- legal-only menu: unassigned todo card offers exactly in_progress (claim first) + cancelled; done/blocked never offered. Classification runs the embedded evaluateDrop via shared dropNeedsClaimPrompt — no second legality implementation.
- claim prompt: menu -> in_progress -> prompt answered 'smoke-user' -> arggon show: status in_progress, assignee smoke-user; card aria-label repainted '(in_progress, @smoke-user)'.
- blocked-reason prompt: 'm' -> blocked -> prompt answered -> arggon show: status blocked, blocked_reason 'waiting on upstream'.
- arrow/Home/End navigation moves a single roving tabindex anchor across and within columns.
- mobile probe: 390x844 hasTouch context, tap .card-move -> tap 'move to cancelled' -> card moves and persists, no drag.

Findings fixed in passing (not filed separately, they were blocking correctness of this flow): (1) attemptMove left the card's aria-label and data-assignee stale after an optimistic move — now repainted on move and restored on revert; (2) re-parenting a focused card drops focus to <body> in Chromium — attemptMove now re-focuses the card/button that held focus (both move and revert paths).

Test-infra note: the menu e2e tests mute the SSE stream with page.route('**/events') registered BEFORE goto; registered after goto the initial EventSource connects unblocked and each successful move location.reload()s the page mid-flow (found via trace). Reload behavior itself stays covered by the existing live-reload test.

Docs: README board section gained a keyboard-and-touch bullet documenting the HTML5 DnD touch limitation and the menu fallback.

### handoff 2026-09-30 @Arggon — next: Review PR #462 (ready): smoke evidence table is in the PR description; reviewer should re-run npx playwright test --grep @smoke and drive the board per docs/engineering.md UI bar. Status flip to done…
- branch: feat/task-board-keyboard-a11y
- open questions: Should the claim/blocked-reason window.prompt flows grow proper dialogs in a follow-up (kept for strict drag parity here)?
