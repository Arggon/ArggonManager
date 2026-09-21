---
type: task
status: todo
id: task-w4-smoke-origin-remote
title: "W4 smoke: reviewer shell gate never exercised (no origin remote)"
parent: native-redesign
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-21"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-w4-smoke-origin-remote.md
  Leaves live only under a story. id is the filename stem: task-w4-smoke-origin-remote.
  CLI `arggon create task w4-smoke-origin-remote` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# W4 smoke: reviewer shell gate never exercised (no origin remote)

## Context

From the W5 full `smoke:opencode` run (2026-09-21): the W4 check "the reviewer's
shell gate denies git push" fails intermittently because the reviewer declines
to run `git push origin main` in a fixture with **no origin remote**, so no
permission denial is emitted. Two independent runs showed the same shape
(transcripts in `/tmp/arggon-smoke-permissions-*`). Pre-existing, not a W5
regression.

## Acceptance

- [ ] The permissions fixture plants an `origin` remote (or the check is rewritten) so the reviewer shell gate is actually exercised and the denial is asserted deterministically.
- [ ] `npm run smoke:opencode` stable across repeated runs.
- [ ] `arggon validate` green; CI green.

## Notes

- Filed per the review-findings rule; W6/W7 territory (smoke stability).
