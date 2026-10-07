---
type: task
status: todo
id: task-decide-codebase-memory-default-discovery
title: "Decide whether codebase-memory-mcp becomes the default code-discovery aid for agents (exploration 013 rec 3, recorded nowhere)"
parent: methodology-improvements
labels: [methodology, decision]
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-decide-codebase-memory-default-discovery.md
  Leaves live only under a story. id is the filename stem: task-decide-codebase-memory-default-discovery.
  CLI `arggon create task decide-codebase-memory-default-discovery` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Decide whether codebase-memory-mcp becomes the default code-discovery aid for agents (exploration 013 rec 3, recorded nowhere)

## Context

Found while reviewing PR #599 (bug-aged-exploration-decisions): exploration-open-source-agent-tooling-013 recommendation 3 — make codebase-memory-mcp the default code-discovery aid for agents — is the one recommendation the repository records NOWHERE. `grep -rl codebase-memory` over the tracked tree hits only that exploration file and the negative-result item body. PR #599 recorded it as "not adopted in this repository" (nothing cross-cutting chosen, so no ADR was owed), which is a true statement about the record but leaves the recommendation unresolved: it was neither adopted nor explicitly rejected.

## Acceptance

- [ ] Decide adopt or reject explicitly, and record it where an agent will actually read it (playbook, `AGENTS.md` seam guidance, or an ADR if cross-cutting)
- [ ] If adopted: the mechanism that makes it the default for agents (skill reference, init-generated guidance, or seam config), plus its cost/limits stated honestly (it is an MCP server, so adopters must register it)
- [ ] If rejected: record the reason in exploration 013's Decision section so the recommendation is closed rather than dangling
- [ ] Exploration 013 updated to point at this decision

## Notes

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-06 @arggon-delivery-lead — routing decision under ADR 0026 §5 (the decision brief)

Recorded from `task-wire-decision-brief-carriers` row 8, which asked the three live cases named in exploration 025 to be **re-briefed or recorded as decided under the new convention**. This is the classification, not the content answer: it records *whether the product owner is asked at all*, which is exactly what ADR 0026 §5's routing rule decides, and it leaves the underlying question open on this item.

**Verdict: this does NOT owe a brief.**

A tooling preference for how agents find code. It is reversible in an afternoon, it is not one of the ADR 0021 §2 authority-map rows, and its cost of being wrong later does not exceed the time to undo it — so under ADR 0026 §5's routing rule it is a call the delivery lead makes and records, not a brief. The convention this item's row asked to exercise: recorded as a routing decision, not re-asked. The content decision itself (adopt or reject) remains open work on this item.

So no `decide:` brief is written for it. Recording the classification matters more than it looks: ADR 0026 §5 exists precisely so that not every open question becomes a brief, and these three were the evidence that questions without a home pile up looking like pending product-owner decisions. Two of them never were one.
