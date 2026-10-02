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
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-decide-codebase-memory-default-discovery.md
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
