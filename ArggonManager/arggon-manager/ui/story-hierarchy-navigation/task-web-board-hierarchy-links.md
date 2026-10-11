---
type: task
status: todo
id: task-web-board-hierarchy-links
title: "Web board detail drawer: link parent and list children"
parent: story-hierarchy-navigation
labels: []
created: "2026-10-11"
updated: "2026-10-11"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-hierarchy-navigation/task-web-board-hierarchy-links.md
  Leaves live only under a story. id is the filename stem: task-web-board-hierarchy-links.
  CLI `arggon create task web-board-hierarchy-links` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board detail drawer: link parent and list children

## Context

Parent story `story-hierarchy-navigation`: the web board's detail drawer (`cli/src/board.ts` ~L1000–1075) shows `parent` as plain text and has no children section. Clicking through the tree is impossible; the only hierarchy surface is the `parent:`/`ancestor:` list filter.

## Acceptance

- [ ] The drawer renders the parent as a link that opens the parent's detail, and a children section listing each child's id + status, each opening that child's detail
- [ ] Items with no parent / no children render that honestly (no dead links, no missing section confusion)
- [ ] Resolution reads the kernel's `parent` edges (no parallel hierarchy); XSS-safe through the existing escape path
- [ ] Axe WCAG A/AA scan stays green in `ui-smoke`; keyboard-reachable (links in the existing tab order); `board-parity` tests pin the new rows
- [ ] `arggon validate` green; prettier clean; PR opened

## Notes
