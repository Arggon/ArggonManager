---
type: task
status: in_progress
id: task-adopter-services-pattern-doc
title: "Adopter pattern doc: per-worktree ephemeral service containers (Compose)"
assignee: Arggon
branch: feat/task-adopter-services-pattern-doc
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs, behavioral, worktree]
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T21:39:33.019Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adopter-services-pattern-doc
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-adopter-services-pattern-doc.md
  Leaves live only under a story. id is the filename stem: task-adopter-services-pattern-doc.
  CLI `arggon create task adopter-services-pattern-doc` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopter pattern doc: per-worktree ephemeral service containers (Compose)

## Context

The documentation side of [ADR 0019](../../../../docs/adr/0019-worktree-runtime-isolation.md)
layer 2 — the pattern adopters with Docker follow to give each worktree its
own stateful services (the collision exploration 016 F1 measured: fixed-host
port `5433` shared by every worktree of a project). Written for the adopter
population of ADR 0005 (low-staffing, agent-operated) and all three platforms
— including the honest macOS/Windows note that Docker Desktop runs a Linux VM
(exploration 016 F9). Carriers touched make this **Behavioral** (ADR 0016).

## Acceptance

- [x] Pattern doc exists and is reachable: docker playbook via `arggon playbook new docker --version <v>` (research with dated sources) or a page under `ArggonManager/docs/` linked from the convention — the choice is stated in the PR. *(Choice: docs page `ArggonManager/docs/worktree-services.md` — a pattern doc, not a version-pinned stack decision, so the playbook template + 90-day freshness gate would misfit. Reachability: cross-linked from spec-worktree-env-contract-016 §Degradation; a `convention.md` cross-link is left to the env-contract implementation PR, which already touches convention.md for `x-worktree.env`.)*
- [x] Covers: Compose project naming `<repo>-<item-id>`; random host-port publishing (or sockets where supported); ephemeral (`--tmpfs`/`--rm`) vs persistent volumes; reading the `.arggon.env` keys; the cleanup declaration manifest; the macOS/Windows Desktop VM cost note.
- [x] Docker claims carry dated sources; cross-links ADR 0019, exploration 017 and spec 016.
- [x] `arggon validate` ok; `arggon spec analyze` reports no NEW findings introduced by the doc. *(6 findings before = 6 after, byte-identical output; baseline captured pre-edit.)*
- [x] Copy-paste example validated live (Docker 29.7.2, 2026-10-01): `docker compose config` parses with/without `WORKTREE_SUFFIX`; two per-worktree projects concurrently on distinct random host ports; data isolation proven cross-project; `down -v --remove-orphans` leaves zero containers/networks/volumes (tmpfs pattern).
- [x] Cross-linked from the spec (one line: "adopter guidance: docs/worktree-services.md" in spec-worktree-env-contract-016 §Degradation).
- [x] Gates: `npm test` untouched-green; prose-format gate (`cli/src/prose-format.test.ts`) green. *(One environmental failure — `headless-ci.test.ts` expecting `lib/dist/index.js` in the fresh worktree — resolved by `npm run build`; doc-only change, zero test files touched.)*

## Notes

- Honesty constraint honored: the env contract is implemented in a parallel PR — the doc is written against spec-worktree-env-contract-016 and carries a "Shipped vs promised vs planned" table (spec-promised pieces marked "not in any release yet"; cleanup reaping marked Planned, pointing at `task-cleanup-declared-services`).
