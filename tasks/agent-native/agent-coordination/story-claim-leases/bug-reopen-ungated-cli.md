---
type: bug
status: done
id: bug-reopen-ungated-cli
title: reopen done->todo is ungated in the CLI (playbook forbids agents; nothing enforces it)
assignee: Arggon
branch: fix/bug-reopen-ungated-cli
parent: story-claim-leases
labels: []
created: "2026-09-13"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-claim-leases/bug-reopen-ungated-cli.md
  Leaves live only under a story. id is the filename stem: bug-reopen-ungated-cli.
  CLI `arggon create bug reopen-ungated-cli` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# reopen done->todo is ungated in the CLI (playbook forbids agents; nothing enforces it)

## Context

Found by the suizo experiment (2026-09-13, verified with a clean repro): `arggon update <done-epic-id> --status todo` returned ok:true with zero resistance. The playbook forbids agents from reopening done/cancelled ("never reopen done/cancelled — agents are refused"), and the MCP layer enforces it via `agent: true` in rules.ts — but the CLI has no caller identity, so the guard is unreachable in the main interface. Same class as bug-cli-steal-not-gated (fixed in PR #128 via TTY confirmation): an agent suizo-needed the reopen for an authorized experiment and the CLI let it through without any marker. Side effect observed: reopening a story left its parent initiative done while the subtree had todo items (asymmetric intermediate states are representable).

## Acceptance

- [x] Same gating treatment as steal (PR #128): reopening done/cancelled via CLI requires interactive TTY confirmation (agents non-interactive → refused), independent of any config; humans keep the ability by confirming
- [x] Tests: CLI reopen by non-TTY → refused with actionable message; TTY confirm → allowed; MCP agent refusal unchanged; kernel contract unchanged
- [x] Docs: skill/claim/agents updated — the reopen rule is now enforced, not documented
