---
type: task
status: todo
id: task-board-serve-hardening
title: "board --serve hardening: origin checks, favicon, optional --open"
parent: ui-web-board-v2
labels: [viewer, board, security, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-serve-hardening.md
  Leaves live only under a story. id is the filename stem: task-board-serve-hardening.
  CLI `arggon create task board-serve-hardening` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# board --serve hardening: origin checks, favicon, optional --open

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The mutating route `POST /api/update` (`cli/src/board-serve.ts`) accepts any request that reaches the loopback port: no Origin/Host/Sec-Fetch-Site validation. JSON content-type does trigger a CORS preflight for cross-origin fetch, but defense in depth is cheap for a local service and keeps the security dimension of the review bar explicit. The page also 404s `/favicon.ico` (only console error in the 2026-09-22 drive), and there is no way to open the browser after `--serve`.

## Acceptance

- [ ] Mutating routes validate Origin/Host (loopback only) and reject cross-site requests with 403; the accepted-request contract is documented
- [ ] A minimal favicon is served (or an explicit empty response) so the console stays clean; static output unaffected
- [ ] Optional `--open` launches the default browser after listen (best-effort, documented)
- [ ] Tests cover the rejection paths; README + docs updated
