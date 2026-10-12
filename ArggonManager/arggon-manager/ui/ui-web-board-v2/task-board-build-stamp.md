---
type: task
status: todo
id: task-board-build-stamp
title: Board serves its build commit so a stale deployment is diagnosable from the drawer
parent: ui-web-board-v2
labels: []
created: "2026-10-12"
updated: "2026-10-12"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-build-stamp.md
  Leaves live only under a story. id is the filename stem: task-board-build-stamp.
  CLI `arggon create task board-build-stamp` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Board serves its build commit so a stale deployment is diagnosable from the drawer

## Context

Found 2026-10-12 from a product-owner report: the drawer on their board shows the PRE-#728 shape (parent as plain text, no children section) while current main provably renders parent-as-link + children (reproduced in Chromium against a fresh `board --serve`: `data-detail-id` anchor + `drawer-children` section present; `/api/item` edges exact). Diagnosis is stale deployment — a checkout/build predating the #728 merge, a cached page/JS bundle, or a static export generated before #728 — but nothing in the board says which commit it was served from, so "stale" vs "broken" took a full repro to separate. The board has a freshness stamp for data; it has no identity for its own build.

## Acceptance

- [ ] The served board and the static export expose the build commit (hash and/or release version) somewhere the viewer can read without devtools (footer, drawer meta, or equivalent)
- [ ] The value comes from the build (`write-build-info.mjs` or equivalent), never hand-maintained
- [ ] Static export stamps at export time; serve mode stamps at server start
- [ ] `board-parity` pins it; `arggon validate` green; prettier clean; PR opened

## Notes
