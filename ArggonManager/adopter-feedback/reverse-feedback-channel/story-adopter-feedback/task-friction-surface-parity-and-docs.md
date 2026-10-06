---
type: task
status: todo
id: task-friction-surface-parity-and-docs
title: "Friction surface parity (native tool, MCP) and JSON contract docs"
parent: story-adopter-feedback
labels: [method]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-friction-tier-b-url-and-optout]
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-surface-parity-and-docs.md
  Leaves live only under a story. id is the filename stem: task-friction-surface-parity-and-docs.
  CLI `arggon create task friction-surface-parity-and-docs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Friction surface parity (native tool, MCP) and JSON contract docs

## Context

Plan task T5 for [spec-friction-capture-020](../../../docs/specs/spec-friction-capture-020.md).

`docs/agents.md` §MCP keeps the CLI, the native tool surface and the MCP tool in
parity, and `cli/src/mcp-parity.test.ts` is the enforcement. A new command that
ships on one surface only is a convention violation, not a shortcut.

**Ownership (reviewer N1):** the additive `doctor --json` `friction` block is
owned **solely** by `task-friction-trigger-carrier` (T6), not by this task. This
task owns CLI/native/MCP parity for `arggon friction` itself and the
`docs/json-output.md` rows for it; T6 owns the block's semantics and tests. The
`doctor.friction` row in `json-output.md` is written here, but the code and its
acceptance criteria are T6's — one owner, one claim.

## Acceptance

- [ ] `tools.arggon.friction` and the `arggon_friction` MCP tool take the same arguments and emit the same envelope fields as CLI `--json`.
- [ ] `cli/src/mcp-parity.test.ts` green.
- [ ] `ArggonManager/docs/json-output.md` documents the `friction` command surface **and** the additive `doctor.friction` block in this same PR (the block's code and tests are T6's; the doc row is this task's, so the two land together).
- [ ] No `schemaVersion` bump is introduced by either surface (asserted in both tasks).
- [ ] Every error path carries a typed `error.code` (`FRICTION_FAILED`) with the documented `reason` values: `no-observation`, `log-unwritable`, and the report/clear conflict.
