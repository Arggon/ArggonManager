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

Plan task T5 for [spec-friction-capture-017](../../../docs/specs/spec-friction-capture-017.md).

`docs/agents.md` §MCP keeps the CLI, the native tool surface and the MCP tool in
parity, and `cli/src/mcp-parity.test.ts` is the enforcement. A new command that
ships on one surface only is a convention violation, not a shortcut.

`doctor --json` also grows the additive `friction` block — the ADR 0020 §2
ruling that makes the channel's absence visible rather than silent.

## Acceptance

- [ ] `tools.arggon.friction` and the `arggon_friction` MCP tool take the same arguments and emit the same envelope fields as CLI `--json`.
- [ ] `cli/src/mcp-parity.test.ts` green.
- [ ] `doctor --json` gains `friction: { triggerPresent, triggerVersion, current, files }`; no `schemaVersion` bump.
- [ ] `doctor --json` on a repo whose managed agent files lack the trigger reports `triggerPresent: false` with the current version (test).
- [ ] `ArggonManager/docs/json-output.md` documents `friction` and `doctor.friction` in this same PR.
- [ ] Every error path carries a typed `error.code` (`FRICTION_FAILED`) with the documented `reason` values: `no-observation`, `log-unwritable`, and the report/clear conflict.
