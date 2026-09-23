---
type: task
status: done
id: task-board-item-detail
title: "Web board item detail drawer (body, checklist, deps, PR)"
assignee: Arggon
branch: feat/task-board-item-detail
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-23"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-item-detail
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-item-detail.md
  Leaves live only under a story. id is the filename stem: task-board-item-detail.
  CLI `arggon create task board-item-detail` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board item detail drawer (body, checklist, deps, PR)

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Cards show the frontmatter summary only; the item body (context, acceptance checklist, comments tail) is invisible on the board, so reviewers leave the browser and open files. The kernel already has a bounded read path (`show`, `loadItem`) that the board route can call in serve mode.

## Acceptance

- [ ] Clicking/Entering a card opens a detail drawer: title, type/priority/status, body, acceptance checkboxes (read-only), labels, dependencies with their statuses (open vs terminal), branch/worktree_path, PR badge/link when the live overlay is on, and the item path
- [ ] Serve mode reads through the kernel (`runShow`/`loadItem`), never raw file reads from the browser; static mode either embeds a bounded detail (documented per-item byte cap) or stays opt-in via a flag — decide and document the payload trade-off
- [ ] Rendering is HTML-escaped/sanitized like the current renderer; Esc closes and returns focus; no tracker writes
- [ ] Tests + Playwright-CLI smoke on a fixture (open a drawer, checklist rows render, Esc closes); README + docs updated

### 2026-09-23 @ses_f343321d7ffe297DRUxJhppxI3
## Worker evidence — serve-mode item detail drawer (PR #412)

**Branch:** feat/task-board-item-detail · **head:** dc166d18 · **PR:** https://github.com/Arggon/ArggonManager/pull/412 · **CI:** cli pass (4m12s), ui-smoke pass (1m33s), tasks-validate pass (37s).

**Decision (static vs serve):** drawer is **serve-only**. Static export stays lean and byte-identical (no drawer markup/endpoint/script; pinned by `renderBoardHtml(..., {details:false}) === plain` and a runBoard drawer-free test). Embedding a bounded detail would need a `--details` flag in `cli/src/cli.ts` (outside this item's file scope) plus a documented per-item cap and payload trade-off — reported to the coordinator, not filed. Trade-off documented in README (board bullet) + ArggonManager/docs/json-output.md (board route/payload contract).

**Shipped:** `GET /api/item?id=<id>` (kernel `runShow` bounded read: prose + last 3 comments; dep statuses from the shared status index; cached live-overlay PR match; caps 8 KiB prose / 4 KiB per comment; 400 blank id, 404 unknown id, other methods → JSON 404; no writes). Client: click/Enter opens, title/type/priority/status/body/read-only acceptance rows/labels/deps open-vs-terminal/branch/worktree_path/PR badge+link/path; Esc (document capture, stopPropagation) closes before the filter's clear and returns focus to the card; close/backdrop too; 404 while open closes with a toast; live reload that removes the item leaves it closed.

**Gates (all in the worktree):**
- `npm test` → 95 files / 1580 tests passed (board+board-serve: 74 tests, incl. new gating/byte-identity/no-innerHTML/caps/tail/deps/PR/400/404/read-only cases).
- `npx playwright test --grep @smoke` → 9 passed: 5 pre-existing + 4 new (Enter/click open + checklist rows + deps + branch/worktree/path; Esc focus return; filtered view + Esc-before-filter precedence; PR link + hostile-URL guard; live-reload-removes-item closes, zero page errors).
- `npm run lint` clean · `npm run build` ok · `npm run check:plugin` ok (bundle unchanged) · `npm run arggon -- validate --json` → ok:true, 0 errors/0 warnings.

**Expected vs observed:**
- Payload size (fixture item, ~22 KB body + 5 comments): item file 22,425 B → `/api/item` 9,721 B; prose clipped to exactly 8,192 B (`prose_truncated:true`), 3 comments returned, 2 hidden. Static board 24,596 B (no drawer) vs served page 34,507 B (+9,911 B one-time drawer chrome/script).
- Sanitization: fixture body line `hostile <img src=x onerror="window.__xss=1"> text` renders as literal text in `.drawer-prose`; `#board-drawer img` count 0; `window.__xss` undefined.
- Reload-removes-item: delete the item file while the drawer is open → SSE reload → card gone, `#board-drawer` hidden, no `pageerror`.

**Known issue note (bug-native-start-worktree-no-install):** `start --worktree` skipped the claim commit (`tsx: command not found`, no node_modules in the fresh worktree). Ran `npm ci`, committed the claim manually as `a54f4580 chore(tasks): started task-board-item-detail`, then implemented on top.

**Fixture note:** the drawer/reload fixture tasks live in `cancelled` so the todo column stays short — Playwright's `dragTo` re-scrolls for the target and a mid-drag scroll makes Chromium resolve the drag source under the stale pointer (the pre-existing status-move test would grab a neighbour card). Pre-existing @smoke cases stay green.

**Open questions (for coordinator):** (1) static `--details` opt-in as a follow-up? (2) `cli/README.md`'s board.ts paragraph does not mention the `/api/item` route (file outside this item's allowlist).

### handoff 2026-09-23 @ses_f343321d7ffe297DRUxJhppxI3 (session: ses_f343321d7ffe297DRUxJhppxI3) — next: Coordinator review of PR #412 (head dc166d18 + tracker commits); merge when green, then verify the @smoke drawer cases on merged main before flipping done.
- branch: main
- open questions: Static --details opt-in follow-up? cli/README.md board route paragraph not updated (outside item file scope).

### handoff 2026-09-23 @ses_f343321d7ffe297DRUxJhppxI3 (session: ses_f343321d7ffe297DRUxJhppxI3) — next: Coordinator review of PR #412 (head dc166d18); merge, then verify the @smoke drawer cases on merged main before flipping done.
- branch: feat/task-board-item-detail
- open questions: Static --details opt-in follow-up? cli/README.md board route paragraph not updated (outside item file scope).
