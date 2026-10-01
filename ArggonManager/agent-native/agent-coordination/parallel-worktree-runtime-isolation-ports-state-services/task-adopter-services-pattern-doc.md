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

The documentation side of [ADR 0019](../../../../docs/adr/0019-worktree-runtime-isolation.md)
layer 2 — the pattern adopters with Docker follow to give each worktree its
own stateful services (the collision exploration 016 F1 measured: fixed-host
port `5433` shared by every worktree of a project). Written for the adopter
population of ADR 0005 (low-staffing, agent-operated) and all three platforms
— including the honest macOS/Windows note that Docker Desktop runs a Linux VM
(exploration 016 F9). Carriers touched make this **Behavioral** (ADR 0016).

## Acceptance

- [x] Pattern doc exists and is reachable: docker playbook via `arggon playbook new docker --version <v>` (research with dated sources) or a page under `ArggonManager/docs/` linked from the convention — the choice is stated in the PR.
- [x] Covers: Compose project naming `<repo>-<item-id>`; random host-port publishing (or sockets where supported); ephemeral (`--tmpfs`/`--rm`) vs persistent volumes; reading the `.arggon.env` keys; the cleanup declaration manifest; the macOS/Windows Desktop VM cost note.
- [x] Docker claims carry dated sources; cross-links ADR 0019, exploration 017 and spec 016.
- [x] `arggon validate` ok; `arggon spec analyze` reports no NEW findings introduced by the doc.

## Notes

### 2026-10-01 @ses_f0697a26dffeiqSzTphhItmARO
Delivered — PR #564 (branch feat/task-adopter-services-pattern-doc), doc at ArggonManager/docs/worktree-services.md.

**Validation evidence (Docker 29.7.2, live, 2026-10-01):** docker compose config parses with and without WORKTREE_SUFFIX; two per-worktree projects (-shop-pr-123/-shop-pr-456) ran concurrently on distinct random loopback ports (32784/32785 vs 32786/32787); a table created via project A's port was invisible via project B's (isolation); down -v --remove-orphans left zero containers/networks/volumes (tmpfs). Also verified live: Compose lowercases interpolated project names; --env-file .arggon.env bridges interpolation but REPLACES .env (documented); .env auto-interpolation and the :? loud-failure variant both behave as documented.

**Gates:** arggon validate ok (0 warnings; pre-commit hook green on commit 7c85f204); npm test 115 files/2053 tests green after npm run build (headless-ci needed lib/dist in the fresh worktree — environmental, no test files touched); prose-format.test.ts 3/3; spec analyze 6 findings before = 6 after (no NEW findings).

**Shipped-vs-planned split documented:** Compose pattern/dir-name wiring/post-start hook/cleanup --prune-for-worktrees = shipped today; .arggon.env six keys + .env seed + preparation.env receipt + x-worktree.env = promised by spec-worktree-env-contract-016 (parallel PR, marked "not in any release yet"); cleanup --prune Compose reaping = Planned (task-cleanup-declared-services).

**Staging:** exactly 3 paths — the doc, the one-line spec cross-link (Degradation), the item file. Prettier's full-file reformat of the merged spec was reverted (drive-by churn; the prose gate does not require prettier-clean docs).

### handoff 2026-10-01 @ses_f0697a26dffeiqSzTphhItmARO (session: ses_f0697a26dffeiqSzTphhItmARO) — next: Coordinator review of PR #564 (do not merge from worker). Optional follow-up: add the convention.md cross-link in the env-contract PR that already touches convention.md.
- branch: main
- open questions: Should the item's 'linked from the convention' acceptance wording be satisfied by the spec cross-link (as done here) or require a convention.md line too?

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Final verdict: approve — reviewer MERGE, no blockers, evidence independently reproduced (the reviewer re-ran the Compose example live on Docker 29.7.2: lowercasing semantics, the :? loud-failure variant, the --env-file replaces .env nuance, ephemeral port publishing + tmpfs isolation + zero-residue teardown). Six env keys match spec 016 exactly; shipped-vs-promised-vs-planned table honest against current main.
Placement: docs/worktree-services.md (not a playbook — correct, it's a pattern doc that would false-trip the 90-day freshness gate); cross-link lives in spec-016 §Degradation; the convention.md link lands with the env-contract implementation PR per spec-016's own acceptance (already required there) — tracked.
Merging after the item-file reconcile.
