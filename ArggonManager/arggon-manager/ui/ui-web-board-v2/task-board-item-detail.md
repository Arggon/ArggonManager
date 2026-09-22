---
type: task
status: todo
id: task-board-item-detail
title: "Web board item detail drawer (body, checklist, deps, PR)"
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-22"
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
