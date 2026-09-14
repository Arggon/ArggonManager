---
type: bug
status: done
id: bug-comment-race-no-lock
title: "comment race: unlocked read-modify-write loses concurrent comments"
assignee: Arggon
branch: fix/bug-comment-race-no-lock
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-comment-race-no-lock.md
  Leaves live only under a story. id is the filename stem: bug-comment-race-no-lock.
  CLI `arggon create bug comment-race-no-lock` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# comment race: unlocked read-modify-write loses concurrent comments

## Context

Exposed by the adversarial lab (`labs/torture.test.ts`, task-adversarial-lab; origin: suizo "necesité reintentos por lock transitorio" follow-up). `runComment` in `cli/src/comment.ts` does a plain `readFileSync`/`writeFileSync` of the item body with NO `withItemLock` — unlike the claim path fixed in bug-claim-race-no-lock (PR #134) and unlike `runUpdate` (which wraps `apply` in `withItemLock`).

Repro: two concurrent `arggon comment <id> ...` processes on the SAME item — one appended comment is silently lost (last full-file write wins). The processes both exit ok, so nothing reports the loss.

## Acceptance

- [x] `runComment` wraps its read-modify-write in `withItemLock` (same lock family as update/start)
- [x] Concurrent same-item comments both land (lab test `labs/torture.test.ts` scenario 2 follow-up un-.todo'd and green)
- [x] No regression in tracker-commit tests / comment tests

## Notes

- Discovered 2026-09-14 by the adversarial lab scenario 2 while converting the adoption-experiment scenarios into a permanent suite.
