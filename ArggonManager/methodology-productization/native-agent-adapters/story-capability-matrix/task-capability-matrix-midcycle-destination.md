---
type: task
status: done
id: task-capability-matrix-midcycle-destination
title: "Capability matrix mid-cycle destination: ledger pin and the pinned binary's orphan/reap behavior until the next re-pin"
assignee: arggon-delivery-lead
branch: feat/task-capability-matrix-midcycle-destination
parent: story-capability-matrix
labels: [adopters, packaging, release]
created: "2026-10-13"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-capability-matrix/task-capability-matrix-midcycle-destination.md
  Leaves live only under a story. id is the filename stem: task-capability-matrix-midcycle-destination.
  CLI `arggon create task capability-matrix-midcycle-destination` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Capability matrix mid-cycle destination: ledger pin and the pinned binary's orphan/reap behavior until the next re-pin

## Context

PR #763 ships `adapters/capability-matrix.json` as a template-bundled `arggon init` destination. At merge time `ARGGON_VERSION` is pinned at 0.7.0 while the new destination exists only in the repo, so the provenance ledger stamp sits at the pin. Residual: the pinned 0.7.0 binary's `init`, run on THIS repo, could classify the new destination as orphaned and reap it (CI never takes that path, and the released version predates the template). Structural to any mid-cycle new destination; the maker deliberately did not grow the diff to cover it.

## Acceptance

- [x] at the next release + re-pin, `arggon doctor --agents` / `arggon init --dry-run` on this repo classify the new destination as expected (present/generated, never orphaned/reaped) — evidence from the released binary
- [x] if the pinned-binary risk is real for arbitrary new destinations, the re-pin routine covers them generally (or a documented step names it)
- [x] no manual version bump; release flow otherwise untouched

## Notes

### 2026-10-14 @Arggon
### Lead closure — 2026-10-14 (delivery lead)
The re-pin landed first (PR #808: ARGGON_VERSION 0.7.0 → 0.10.0 + seam regenerated + ledger refreshed; release.md §The re-pin). Verified against the **released binary** on this repo:
- `npx arggon-manager@0.10.0 doctor --agents --json` → `matrix.present: true`, source `adapters/capability-matrix.json`, 15 rows, 2 gaps, invalid 0.
- `npx arggon-manager@0.10.0 init --dry-run --json` → plan row `adapters/capability-matrix.json`: decision `updated` — "untouched since last generation — regenerated from the current template"; `reaped: 0`, `reapRefused: 0` — never orphaned, never reaped.
- The class is covered generally by the existing routine: the re-pin regenerates the seam + records after each release, and the pin now names a released version that ships the template, so the mid-cycle orphan/reap window closes without a new step. No manual version bump; the release flow is untouched.
