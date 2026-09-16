---
type: bug
status: todo
id: bug-cascade-lost-update
title: cascade lost-update on shared ancestor writes
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

- [ ] Reproduce deterministically (two concurrent sibling done-flips racing the shared ancestor write) and document the interleave
- [ ] Fix: the ancestor write must be guarded (e.g. acquire the ancestor's item lock, or a container-level lock) without introducing deadlock between child and ancestor locks (document the lock ordering)
- [ ] Tests: concurrent sibling flips land both statuses + the ancestor ends consistent; torture scenario 1 green across repeated runs

## Notes
