---
type: task
status: in_progress
id: task-opencode2-payload-contract-preparation-fields
title: "`docs/opencode2.md` Payload contract omits `preparation.claim` and `preparation.env`, so shipped take-over/receipts are invisible there"
assignee: Arggon
branch: feat/task-opencode2-payload-contract-preparation-fields
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs]
created: "2026-10-02"
updated: "2026-10-03"
claimed_at: "2026-10-03T02:50:00.635Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-opencode2-payload-contract-preparation-fields
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-opencode2-payload-contract-preparation-fields.md
  Leaves live only under a story. id is the filename stem: task-opencode2-payload-contract-preparation-fields.
  CLI `arggon create task opencode2-payload-contract-preparation-fields` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/opencode2.md` Payload contract omits `preparation.claim` and `preparation.env`, so shipped take-over/receipts are invisible there

## Context

Found while reviewing PR #598 (task-adr-0019-hatch-shipped-wording): `ArggonManager/docs/opencode2.md` §Payload contract documents the `start` row's `preparation?` field but never names `preparation.claim` or `preparation.env`, so the shipped claim stamp / take-over receipt and the worktree env contract are invisible in the architecture doc. Pre-existing since PR #568 (task-strict-attach-dead-owner-hatch). A gap in the doc, not a false statement — the fields exist and ship.

## Acceptance

- [ ] The `start` row documents `preparation.claim` (stamp owner/claim time/takeOver/takeovers) and `preparation.env` (written/keys/gitignored/warning)
- [ ] A doc-contract test asserts the documented shape matches the shipped payload, so a new `preparation.*` field cannot ship undocumented

## Notes
