---
type: task
status: todo
id: task-dated-correction-not-self-verifying
title: "A dated correction block is append-only but not self-checking: a wrong one becomes the next worker's brief, read as more authoritative than the work it corrects"
parent: methodology-improvements
labels: [methodology, tracker-schema]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-dated-correction-not-self-verifying.md
  Leaves live only under a story. id is the filename stem: task-dated-correction-not-self-verifying.
  CLI `arggon create task dated-correction-not-self-verifying` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# A dated correction block is append-only but not self-checking: a wrong one becomes the next worker's brief, read as more authoritative than the work it corrects

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
Found during the merge verification of PR #619 (merged as `8f7f2f3a8`), by the maker fixing that item's own review blockers. **Filed here as a methodology gap rather than on the item that exposed it**, because no single item is broken — the loop is.

### Context

`bug-zero-byte-item-files-committed-by-comment-autocommit` carried a dated correction block added 2026-10-03 by the round-1 reviewer of PR #619. That block was **wrong in all four rows** of its table and drew a conclusion the evidence disproves:

- its four "emptying commits" (`16295623`, `e52f33c3`, `e470c86d`, `0490dda1`) actually hold 14037 / 3463 / 8304 / 5388 bytes — they are the last **non-empty** commits, i.e. the correct *recovery sources* for `9c17ae6c`, not the commits that emptied anything
- its headline claim "three of the four were already 0 bytes in the parent, so the corruption travels between worktrees" is false. Measured by blob size: each blamed commit is single-parent and each parent holds *its own* file non-empty, so each is where its file **first** became 0 bytes
- its title said "2 are squash-merged PR commits". It is **1** (`ac3fe3c6`, #521)

In fairness to that reviewer, the **readings** were right: at `ce5e855a` three of four are indeed 0 bytes. The inference was not, and emptiness persists forward once introduced, which is the trap.

The part that matters methodologically: this wrong correction was, by 2026-10-06, **the brief the next worker acted on**. And the author of that correction had themselves taken a prior account at face value and been wrong. So the failure mode is not one careless writer. It is that a correction, once written in the authoritative voice inside the append-only record, carries more weight than the measurement under it, and **nothing in the loop re-derives it**.

The fix in this instance was a person re-measuring blob sizes at every touching commit. That is luck, not a gate.

### Acceptance

- [ ] State the rule in the methodology carrier: a dated correction block is **history and not self-establishing**. It must be attributed to the measurement or command that produced it (commit shas, paths, blob sizes, dates), so a later reader can re-derive it instead of trusting it
- [ ] Require that a correction which **supersedes** a claim say what re-measurement falsified it — distinguishing "my earlier reading was wrong" from "the reading was right and the inference from it was wrong". Both occurred here and they call for different follow-ups
- [ ] When a correction changes an item's *title* or operative acceptance boxes, strike the superseded text through and mark it `RESOLVED <date>, do not redo` rather than deleting it, so the superseded brief stays auditable. That pattern is already in use; make it the norm
- [ ] Decide whether the `done` gate should require a correction block to name its evidence, so an unevidenced correction cannot close an item — noting `--waive` stays human-only
- [ ] Reconcile with the existing carrier rule that dated comments are verbatim history while **live body prose** is current state (`docs/agents.md` §0, and the PR #586 ruling): a correction is the case where that distinction matters most, because it lives in history but changes what a reader of history should believe
