---
type: task
status: in_progress
id: task-native-panel-refresh-filter
title: "OpenCode panel: live refresh, fold/filter and paging"
assignee: Arggon
branch: feat/task-native-panel-refresh-filter
parent: ui-native-panel-v2
labels: [opencode-seam, tui, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T15:23:01.347Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-native-panel-refresh-filter
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-native-panel-v2/task-native-panel-refresh-filter.md
  Leaves live only under a story. id is the filename stem: task-native-panel-refresh-filter.
  CLI `arggon create task native-panel-refresh-filter` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode panel: live refresh, fold/filter and paging

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- Ticked against the PR branch 2026-09-30; evidence in the review comment. -->

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The sidebar snapshot is created on mount with no setter (never refreshes) and the panel only reloads on `r`; done/cancelled items crowd the tree and the 200-line limit hides the rest with a single `… more item(s)` hint.

## Acceptance

- [x] Panel and sidebar refresh on tracker changes (or session events) instead of mount-only; `r` remains a manual reload
- [x] Fold/hide: collapse subtrees, hide `done`/`cancelled`, and a text filter on id/title; state kept per session
- [x] Paging beyond the 200-line cap (or an explicit, navigable "more" affordance)
- [x] Tests + a filtered/folded smoke capture; docs updated

### 2026-09-30 @Arggon
Implementation verdict (2026-09-30, @Arggon): all four acceptance boxes ticked on the PR branch (commit 006e4bff). Deviations from a literal reading of the work order, recorded for review: (1) live refresh is timer-based (10s, ARGON_BOARD_REFRESH_MS override) rather than session-event-based — the TUI plugin context exposes no tracker-change event, and the tick is one in-process kernel read; (2) per-session view state is in-memory (survives panel close/reopen, isolated per session) rather than durable host storage — the TUI context has no storage contract; (3) the text filter edits via plain-letter binds (s + letters + backspace + Enter) because the panel keymap layer only receives bound keys — digits/dash/dot/slash/backspace sit in a separate best-effort keymap layer so an unknown name on a host cannot kill the panel keys; (4) paging builds on PR #411's window-follow (this branch is stacked on feat/task-native-panel-interaction, PR base is that branch until it merges) and adds the explicit (PgDn pages)/(PgUp) hints.

Gates on the PR head: npm test 107 files / 1803 tests; lint; lint:structure; test:structure (3 passed); build; check:plugin (bundle regenerated, 394093 B); smoke:tui 23/23 in a real PTY (filter typing live, fold hint, done-hide round-trip, live refresh picking up a mid-run tracker write with no r pressed, corrupt-tracker P1 degradation); arggon validate --json ok:true; prettier clean on touched files.

Docs updated: docs/opencode2.md § TUI (prose + checklist rows) and docs/playbooks/opencode.md § Testing.

### handoff 2026-09-30 @Arggon — next: Coordinator: merge PR #411 first (this PR is stacked on it), then review/merge PR #470; flip the item to done after merge.
- branch: feat/task-native-panel-refresh-filter
- open questions: Durable (host-storage) per-session view state was skipped — the TUI context has no storage contract; file a follow-up if wanted
