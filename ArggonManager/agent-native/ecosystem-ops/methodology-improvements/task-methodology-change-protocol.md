---
type: task
status: done
id: task-methodology-change-protocol
title: methodology-change-protocol
assignee: Arggon
branch: feat/task-methodology-change-protocol
parent: methodology-improvements
labels: []
priority: p2
created: "2026-09-29"
updated: "2026-09-30"
depends_on: [task-adr-adopter-upgrade-channel]
worktree_path: /home/arggon/Projects/ArggonManager-task-methodology-change-protocol
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-methodology-change-protocol.md
  Leaves live only under a story. id is the filename stem: task-methodology-change-protocol.
  CLI `arggon create task methodology-change-protocol` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# methodology-change-protocol

## Context

<!-- Why this task exists. -->

## Acceptance

- [x] 

## Notes

### 2026-09-29 @Arggon
### Context — C4b (exploration-methodology-improvements-014)

ADR 0011 made the methodology the contract, but no process governs changing the contract. Depends on `task-adr-adopter-upgrade-channel` (ADR 0014) — reference its decision.

Add to `docs/agents.md` a bounded section "Changing the methodology itself" (+ one review-bar line in `docs/engineering.md`):
- Impact classes: **advisory** (wording/docs, no behavior change for adopting agents) vs **behavioral** (agents must re-learn a rule, gate or pipeline step).
- Any PR touching methodology carriers (`ArggonManager/docs/agents.md`, `docs/engineering.md`, `docs/convention.md`, `skills/arggon-cli/**` incl. `references/`) states its impact class in the PR and as an item comment; behavioral changes reference ADR 0014 and re-sync the skill copies (byte-parity) in the same PR.
- Reviewers check the class statement like any review-bar item.

### Acceptance checklist
- [x] `docs/agents.md` section (~20 lines max) + `docs/engineering.md` review-bar line.
- [x] References ADR 0014 consistently with its decision.
- [x] Docs-only PR; `arggon validate` ok.
