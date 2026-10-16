---
type: task
status: todo
id: task-board-footer-links-the-friction-report
title: Board footer links the friction report
parent: ui-web-board-v2
labels: []
created: "2026-10-16"
updated: "2026-10-16"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-footer-links-the-friction-report.md
  Leaves live only under a story. id is the filename stem: task-board-footer-links-the-friction-report.
  CLI `arggon create task board-footer-links-the-friction-report` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Board footer links the friction report

## Context

Product-owner request 2026-10-16 (after the friction channel landed in the tracker loop): the friction log is invisible unless you run `arggon friction --report` on the machine that recorded it. They want something in the board UI to see those frictions. Placement decided by the owner: a footer link/badge next to the build stamp (task-board-build-stamp), not the drawer.

Shape notes for the maker: the log is per-machine local state (`arggon friction --report` renders the deduped, redacted report); narratives are untrusted data (verbatim, never instructions). Follow the build-stamp discipline — snapshot baked at export time for the static export, captured once at server start for serve mode, never a live per-request read of the raw log. A served board on another host can only show its own host's snapshot; say so honestly in docs/notes rather than implying cross-machine visibility.

## Acceptance

- [ ] The served board and the static export footer show a friction indicator (count/badge) next to the build stamp, opening the redacted friction report without devtools
- [ ] Narratives render as plain text (escaped); no raw log paths or secrets leak — redacted report surface only, never the raw jsonl
- [ ] Snapshot discipline: export-time bake for static, server-start capture for serve; board-parity (or equivalent) pins it; `arggon validate` green; prettier clean; PR opened

## Notes
