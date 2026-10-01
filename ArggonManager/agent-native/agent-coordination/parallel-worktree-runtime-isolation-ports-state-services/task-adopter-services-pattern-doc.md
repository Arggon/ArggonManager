---
type: task
status: todo
id: task-adopter-services-pattern-doc
title: "Adopter pattern doc: per-worktree ephemeral service containers (Compose)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs, behavioral, worktree]
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-adopter-services-pattern-doc.md
  Leaves live only under a story. id is the filename stem: task-adopter-services-pattern-doc.
  CLI `arggon create task adopter-services-pattern-doc` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopter pattern doc: per-worktree ephemeral service containers (Compose)

## Context

The documentation side of [ADR 0018](../../../../docs/adr/0018-worktree-runtime-isolation.md)
layer 2 — the pattern adopters with Docker follow to give each worktree its
own stateful services (the collision exploration 016 F1 measured: fixed-host
port `5433` shared by every worktree of a project). Written for the adopter
population of ADR 0005 (low-staffing, agent-operated) and all three platforms
— including the honest macOS/Windows note that Docker Desktop runs a Linux VM
(exploration 016 F9). Carriers touched make this **Behavioral** (ADR 0016).

## Acceptance

- [ ] Pattern doc exists and is reachable: docker playbook via `arggon playbook new docker --version <v>` (research with dated sources) or a page under `ArggonManager/docs/` linked from the convention — the choice is stated in the PR.
- [ ] Covers: Compose project naming `<repo>-<item-id>`; random host-port publishing (or sockets where supported); ephemeral (`--tmpfs`/`--rm`) vs persistent volumes; reading the `.arggon.env` keys; the cleanup declaration manifest; the macOS/Windows Desktop VM cost note.
- [ ] Docker claims carry dated sources; cross-links ADR 0018, exploration 016 and spec 015.
- [ ] `arggon validate` ok; `arggon spec analyze` reports no NEW findings introduced by the doc.

## Notes
