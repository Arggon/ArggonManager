---
type: bug
status: done
id: bug-cascade-lost-update
title: cascade lost-update on shared ancestor writes
assignee: Arggon
branch: fix/bug-cascade-lost-update
parent: story-github
labels: [p2]
created: "2026-09-16"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/bug-cascade-lost-update.md
  Leaves live only under a story. id is the filename stem: bug-cascade-lost-update.
  CLI `arggon create bug cascade-lost-update` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cascade lost-update on shared ancestor writes

## Context

Follow-up from the bug-torture-contention-flake3 investigation (PR #280): labs/torture scenario 1 (N=8 mixed operations) flaked once locally and once in CI (run 34998411032, labs/torture.test.ts:248 — sibling status `in_progress` vs `done`): a CASCADE lost-update in cli/src/update.ts's multi-file write path — the cascade writes ancestor files while holding the CHILD's item lock, so two concurrent updates on siblings can interleave ancestor writes (last-write-wins on the ancestor body/frontmatter, losing a status flip). Distinct from the item-lock family: the lock covers one item, not the ancestor write set.

## Acceptance

- [x] Reproduce deterministically (two concurrent sibling done-flips racing the shared ancestor write) and document the interleave
- [x] Fix: the ancestor write must be guarded (e.g. acquire the ancestor's item lock, or a container-level lock) without introducing deadlock between child and ancestor locks (document the lock ordering)
- [x] Tests: concurrent sibling flips land both statuses + the ancestor ends consistent; torture scenario 1 green across repeated runs

## Notes

- Repro (cli/src/cascade.test.ts, "repro: the cascade never writes an ancestor while the ancestor's item lock is held"): the test holds story-a's item lock (same lock family/format as cli/src/lock.ts) in the test process and runs the child's done-flip in a real separate process. Pre-fix (verified via `git stash` of the fix): the cascade wrote story-a `done` without ever attempting its lock — story-a ended `done` while another writer held the lock mid read-modify-write. Post-fix: the cascade blocks, times out per the lock-family convention, and reports `{reason: "lock-timeout"}` in `cascadeSkipped`; the ancestor is untouched; a retriggered terminal update completes the chain.
- Interleave: P1 (cascade from a child done-flip, holds CHILD lock only) reads the ancestor snapshot and writes it while P2 (direct ancestor update, holds the ANCESTOR lock) reads/edits/writes the same file — last-write-wins, one side's change silently lost. The child lock covers one item, not the ancestor write set.
- Fix: autoCompleteAncestors (cli/src/update.ts) now holds each ancestor's item lock across a FRESH re-read + acceptance check + write. LOCK ORDERING: strictly CHILD -> ANCESTORS upward, one ancestor at a time; all other lock sites (update/start item lock, comment item lock) take exactly one item lock; tracker-commit's git lock is a different family acquired after the item locks are released — no opposite-order acquisition exists (audited all withItemLock call sites).
- Tests: repro (deterministic, pre-fix red / post-fix green), 3-round concurrent sibling done-flip race (both statuses land, ancestor ends consistent, no silent half-state), cascade suite 21/21, full suite 939 passed, lint+tsc clean. labs/torture scenario 1: green x6 consecutive runs.
- docs: docs/json-output.md cascadeSkipped row updated for the additive `lock-timeout` reason; human output prints a reason-aware `cascade skipped:` line (cli/src/cli.ts).

## Notes

### 2026-09-16 @Arggon
Lead-architect review: APPROVED (deep-validated). The interleave analysis is precise (child lock ≠ ancestor write set — P1 writes the ancestor snapshot while P2 holds the ancestor lock), the fix acquires the ANCESTOR's item lock around a FRESH re-read + acceptance check + write (killing the stale-snapshot race, not just the write race), lock-timeout degrades to a reported skip with the additive reason, and the deadlock audit documents leaf-first ordering with no reverse acquisition. Pre-fix red verified via stash, deterministic repro, sibling race x3 rounds green, torture x6. The reason-aware human line (fixing the pre-existing cli.ts misprint) is a bonus. Merge follows.
