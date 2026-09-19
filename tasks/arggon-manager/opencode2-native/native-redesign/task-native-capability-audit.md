---
type: task
status: in_progress
id: task-native-capability-audit
title: Audit every OpenCode V2 surface and map ArggonManager capabilities
assignee: Arggon
branch: feat/task-native-capability-audit
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
claimed_at: "2026-09-19T20:16:52.992Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-capability-audit
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-capability-audit.md
  Leaves live only under a story. id is the filename stem: task-native-capability-audit.
  CLI `arggon create task native-capability-audit` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Audit every OpenCode V2 surface and map ArggonManager capabilities

## Context

First wave of epic `opencode2-native`. Produce the exploration
`docs/explorations/exploration-opencode2-native-010.md` (next free id) that
inventories every OpenCode V2 surface and maps each ArggonManager capability to
native mechanisms.

Sources: `https://opencode.ai/v2/llms.txt` (docs index), the V2 docs (accessed
2026-09-19), the installed runtime (v2.0.8), ADR 0010 + playbook +
`exploration-opencode-v2-native-009` (baseline), and the current code
(`cli/src/`, `opencode/plugins/arggon/`).

Required sections:

- **Inventory of V2 surfaces**: config/instructions, agents, commands, skills,
  plugins (transforms, hooks, events, storage, permissions, sessions,
  worktrees, VCS, generate, client/SDK/RPC); CLI/TUI plugins (commands,
  keymaps, routes, slots/panels, dialogs, markdown renderers); MCP (keep,
  replace or drop); API/client; Code Mode; compaction/context; snapshots;
  sharing.
- **Capability map**: for each ArggonManager capability (item CRUD, validate,
  board, claim, start/worktree, review gate, done/cascade, spec/ADR/plan docs,
  doctor, init/scaffold, orchestration, context injection) list the native
  mechanism(s) that could own it, with trade-offs.
- **Decision points, each with a recommendation** (the product owner delegated
  these to the audit, 2026-09-19):
  - **D1 — source of truth**: git-native `tasks/` vs OpenCode runtime state
    (storage/DB).
  - **D2 — methodology contract**: keep the Agile tree + claim→worktree→PR→
    review→done loop as fixed contract, or redesign the flow/states/gates with
    native primitives.
  - Implementation-level: in-process plugin tools vs child-process kernel; TUI
    plugin as the board; worktree strategy via `ctx.worktree.transform`; rule
    enforcement via `ctx.permission.rules`; distribution (npm package vs
    vendored file).
- **Risks**: API churn (pin 2.0.x), failure isolation, testing strategy
  without the CLI, adopter bootstrap without `arggon init`, migration of
  existing `tasks/` trees.
- **Recommendation** + ADR outline.

## Acceptance

- [ ] Exploration doc merged under `docs/explorations/` following
      `templates/exploration.md`, with dated sources.
- [ ] Every ArggonManager capability is either assigned a native mechanism or
      explicitly dropped, with rationale.
- [ ] D1 (source of truth) and D2 (methodology contract) each have a
      recommendation with trade-offs, ready for the ADR.
- [ ] ADR outline ready (next ADR number, 0011) for the follow-up task.
- [ ] `arggon validate` green; no code changes in this task.

## Notes

- This audit decides direction; `install-ergonomics` is reassessed when it
  lands.
