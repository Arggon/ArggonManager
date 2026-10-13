---
type: story
status: todo
id: parallel-worktree-runtime-isolation-ports-state-services
title: "Parallel worktree runtime isolation (ports, state, services)"
parent: agent-coordination
labels: []
created: "2026-10-01"
updated: "2026-10-01"
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/parallel-worktree-runtime-isolation-ports-state-services.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Parallel worktree runtime isolation (ports, state, services)

## Context

This story is the runtime half of the `agent-coordination` epic. The epic's
Context states the gap plainly: claims are the coordination primitive, but
worktree isolation is manual playbook discipline. The coordinator runs waves
of workers, one worktree each — and worktrees isolate _files_ but not
_runtime state_: parallel runs of the same project collide on fixed ports,
shared local services and singleton state dirs. That is the product-owner
question behind exploration 017
(`ArggonManager/docs/explorations/exploration-worktree-env-isolation-017.md`):
"we cannot run the same project multiple times to test different changes
simultaneously … Docker might be the solution, but let's find the best
approach that consumes the fewest possible resources." The owner accepted the
layered recommendation on 2026-10-01 (recorded on
`task-record-exploration-016-worktree-runtime-isolation`), decided in
[ADR 0019](ArggonManager/docs/adr/0019-worktree-runtime-isolation.md):

- **Layer 1, env contract by default** (ADR 0019 decision 1;
  `ArggonManager/docs/specs/spec-worktree-env-contract-016.md`): `start
--worktree` writes the gitignored `.arggon.env` worktree identity, seeds
  `.env` copy-if-absent, creates per-OS suffixed state/cache dirs, and reports
  the additive `preparation.env` receipt. Shipped by
  `task-env-contract-start` (PR #566).
- **Layer 0, single-writer ownership** (ADR 0019 decision 4, amended by PR
  #568): the `arggon-claim.json` stamp in the worktree's git dir plus
  attach-time foreign-writer detection, report-only by default, escalated by
  `x-tracker.strict-worktree-writes`. Shipped by
  `task-single-writer-worktree-enforcement` (PR #568); the arm-vs-report-only
  call itself is the open decision on `task-arm-strict-worktree-writes`.
- **Layer 2, ephemeral service containers as opt-in pattern** (ADR 0019
  decision 2): per-worktree Compose projects the convention declares, reaped
  by `cleanup --prune`; the kernel never probes Docker it was not told about.
  Shipped by `task-cleanup-declared-services`,
  `task-adopter-services-pattern-doc` and `task-native-cleanup-compose-parity`.
- **Rejected as defaults** (ADR 0019 decision 3): full dev-environment
  containers, distrobox/toolbox, VMs per worktree; Nix stays an optional
  complement.

The story also carries the seam/parity hardening the same waves surfaced:
the coordinator must actually claim through the native start path or every
guarantee above is inert (`task-coordinator-claims-through-native-start`,
done), dead-owner recovery must be reachable from both surfaces
(`task-strict-attach-dead-owner-hatch`, `task-native-start-take-over-input`,
done), and the bounded-output follow-ups still open — the clip-order class
sweep, `stepsTruncated` carriage on the CLI surface, and the `foreignWrites`
character-clip flag semantics (`task-clip-class-sweep-remaining-sites`,
`task-cli-surface-never-carries-steps-truncated`,
`task-foreign-writes-char-clip-truncated`).

## Acceptance

- [ ] Layer 1 holds on both surfaces: `start --worktree` writes the gitignored `.arggon.env` identity, seeds `.env` copy-if-absent, creates the per-OS suffixed state/cache dirs, and reports the additive `preparation.env` receipt (`task-env-contract-start`)
- [ ] Layer 0 holds by default and the escalation is decided: the claim stamp plus attach-time foreign-writer detection stay report-only unless `x-tracker.strict-worktree-writes` is deliberately armed, and the arm-vs-report-only decision — with its compensating coordination rule if report-only is kept — is recorded (`task-single-writer-worktree-enforcement`; `task-arm-strict-worktree-writes`)
- [ ] Layer 2 holds without kernel overreach: declared per-worktree Compose projects are reaped by `cleanup --prune` on the CLI and the native surface alike, the opt-in pattern is documented for adopters, and undeclared Docker is never probed or invoked (`task-cleanup-declared-services`; `task-adopter-services-pattern-doc`; `task-native-cleanup-compose-parity`)
- [ ] The coordinator claims through `tools.arggon.start`, so stamps, `worktree_path` records, readiness receipts and draft PRs exist for the layers above to act on (`task-coordinator-claims-through-native-start`)
- [ ] Recovery and parity are closed: a dead stamped owner is recoverable from both surfaces (take-over hatch plus the named manual step), and the bounded-output follow-ups are fixed-or-recorded — the clip-order class sweep, `stepsTruncated` on both surfaces, the `foreignWrites` character-clip flag semantics (`task-strict-attach-dead-owner-hatch`; `task-native-start-take-over-input`; `task-clip-class-sweep-remaining-sites`; `task-cli-surface-never-carries-steps-truncated`; `task-foreign-writes-char-clip-truncated`)

## Notes
