---
type: task
status: in_progress
id: task-arm-strict-worktree-writes
title: "Arm `x-tracker.strict-worktree-writes` for the coordinator's parallel waves (or record why the report-only default is kept)"
assignee: arggon-delivery-lead
branch: feat/task-arm-strict-worktree-writes
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, methodology]
priority: p3
created: "2026-10-02"
updated: "2026-10-15"
claimed_at: "2026-10-15T13:21:32.409Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-arm-strict-worktree-writes
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-arm-strict-worktree-writes.md
  Leaves live only under a story. id is the filename stem: task-arm-strict-worktree-writes.
  CLI `arggon create task arm-strict-worktree-writes` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Arm `x-tracker.strict-worktree-writes` for the coordinator's parallel waves (or record why the report-only default is kept)

## Context

Found by a 0.5.0 adoption audit (2026-10-02, coordinator session). This repo
_is_ the parallel-worktree-runtime-isolation epic: the coordinator runs waves
of workers, one worktree each. `ArggonManager/.convention.yml` already arms
`x-tracker.strict-gate-bins: true` (#533) but carries no
`strict-worktree-writes` key (observed), so #568's single-writer observation
stays a warning that no one reads at the moment of collision. That is the
report-only default working as designed — the flag is opt-in and its refusal
is deliberately coordination-shaped, not deletion-shaped — so this item is a
decision item, not a bug.

Today's state is the F12 scenario with the guard off: three worktrees carry
uncommitted changes, and two of them belong to items that are still
`todo`/unclaimed on `origin/main` with no `worktree_path`, so no stamp could
even have been written (see `task-coordinator-claims-through-native-start`).

Routing (2026-10-07, recorded from `task-wire-decision-brief-carriers` row 8
under ADR 0026 §5): of the three live cases asked to be re-briefed or recorded
as decided, this is the closest — turning a safety observation into an
enforcement refusal reads like a harder-to-reverse call — and it still does
not owe a brief. The flag is one line of config, reverting it restores the
report-only default immediately, and ADR 0026 §5's second limb is about cost
paid later exceeding the time to undo, which a config flip does not meet. It
is a lead decision recorded on the item: if the lead arms it, the contract's
own requirement (the refusal shape documented and a real refused attach as
evidence) still applies. Recording the classification matters because ADR 0026
§5 exists precisely so that not every open question becomes a brief.

## Acceptance

- [ ] Decision recorded on the item: arm the flag, or keep report-only with the compensating coordination rule written down (which one is a deliberate choice, not a default)
- [ ] If armed: `x-tracker.strict-worktree-writes: true` in `ArggonManager/.convention.yml`, and `ArggonManager/docs/agents.md` §worktree rules updated so the worker contract states the refusal shape (the stamped owner, claim time, newer files) and BOTH dead-owner recovery paths — `start --worktree --take-over-worktree` and the manual `rm <git-dir>/arggon-claim.json`
- [ ] If armed: evidence from a real refused attach (or `npm run smoke:native-start-cold`) showing the refusal names the owner before any item mutation
- [ ] If not armed: the compensating rule is written into the coordinator contract (who owns a worktree, how a collision is noticed, who may resolve it)

## Notes

### 2026-10-02 @ses_f03213cdbffeJ4RqV9JXfur867

Found by a 0.5.0 adoption audit (2026-10-02, coordinator session).

## Context

This repo _is_ the parallel-worktree-runtime-isolation epic: the coordinator runs waves of workers,
one worktree each. `ArggonManager/.convention.yml` already arms `x-tracker.strict-gate-bins: true`
(#533) but leaves `strict-worktree-writes` unset, so #568's single-writer observation stays a
warning that no one reads at the moment of collision. That is the report-only default working as
designed — the flag is opt-in and its refusal is deliberately coordination-shaped, not deletion-shaped
— so this item is a decision item, not a bug.

Today's state is the F12 scenario with the guard off: three worktrees carry uncommitted changes, and
two of them belong to items that are still `todo`/unclaimed on `origin/main` with no
`worktree_path`, so no stamp could even have been written (see
task-coordinator-claims-through-native-start).

## Acceptance

- [ ] Decision recorded on the item: arm the flag, or keep report-only with the compensating
      coordination rule written down (which one is a deliberate choice, not a default).
- [ ] If armed: `x-tracker.strict-worktree-writes: true` in `ArggonManager/.convention.yml`, and
      `ArggonManager/docs/agents.md` §worktree rules updated so the worker contract states the
      refusal shape (the stamped owner, claim time, newer files) and BOTH dead-owner recovery paths
      — `start --worktree --take-over-worktree` and the manual `rm <git-dir>/arggon-claim.json`.
- [ ] If armed: evidence from a real refused attach (or `npm run smoke:native-start-cold`) showing
      the refusal names the owner before any item mutation.
- [ ] If not armed: the compensating rule is written into the coordinator contract (who owns a
      worktree, how a collision is noticed, who may resolve it).

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG

### 2026-10-06 @arggon-delivery-lead — routing decision under ADR 0026 §5 (the decision brief)

Recorded from `task-wire-decision-brief-carriers` row 8, which asked the three live cases named in exploration 025 to be **re-briefed or recorded as decided under the new convention**. This is the classification, not the content answer: it records _whether the product owner is asked at all_, which is exactly what ADR 0026 §5's routing rule decides, and it leaves the underlying question open on this item.

**Verdict: this the closest of the three, and still does not owe a brief.**

This one turns a safety observation into an enforcement refusal, which reads like a harder-to-reverse call. It still does not owe a brief: the flag is one line of config, reverting it restores the report-only default immediately, and ADR 0026 §5's second limb is about _cost paid later exceeding the time to undo_ — which a config flip does not meet. It is a lead decision recorded on the item. If the lead decides to arm it, the contract's own requirement (the refusal shape documented and a real refused attach as evidence) still applies.

So no `decide:` brief is written for it. Recording the classification matters more than it looks: ADR 0026 §5 exists precisely so that not every open question becomes a brief, and these three were the evidence that questions without a home pile up looking like pending product-owner decisions. Two of them never were one.

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
**Decision (2026-10-15, delivery lead — recorded on the item per box 1): KEEP report-only; do not arm `x-tracker.strict-worktree-writes`.**

Rationale:
1. The observed collisions are the ones the flag cannot see: the item's own F12 case (three worktrees, two items `todo`/unclaimed on main with no `worktree_path`) had **no stamp at all** — the strict refusal only fires on a stamped owner mismatch, so arming would not have caught it. The real fix for that class was the claim discipline (`task-coordinator-claims-through-native-start`, done).
2. Arming would refuse the delivery lead's legitimate recovery and merge-prep writes into a maker's worktree (finishing work after a maker session dies — several occurrences this week alone) unless each goes through the takeover ceremony. The refusal is coordination-shaped and reversible, but the friction lands on the flow that keeps waves moving.
3. The default is explicitly "working as designed" (the item's own framing); arming stays available later — one config line — if a stamped collision ever actually bites.

**Compensating rule (box 4), queued for wave 4 (docs-only):** the coordinator contract (`ArggonManager/docs/agents.md` §Orchestration + the worktree rules) states: who owns a worktree (the session its claim stamp carries; the lead owns the item, the maker owns the worktree while the claim lives); how a collision is noticed (the single-writer observation + the `arggon-claim.json` stamp; `arggon doctor` where it reports); and who may resolve it (the stamped owner, or the lead through `start --worktree --take-over-worktree` / the manual `rm <git-dir>/arggon-claim.json` recovery — never a hand-write into another live session's worktree).

### 2026-10-15 @arggon-maker
Evidence — compensating rule shipped (acceptance box 4), docs-only.

**Change:** `ArggonManager/docs/agents.md` — new §Orchestration subsection "Worktree ownership and collisions" (owner / notice / resolution + the standing report-only decision), echoed in §4 → Single-writer ownership. `.convention.yml` untouched (flag stays unarmed). Commit `89d5dc17`; PR #842.

**What the rule states**

- Owner: the worktree belongs to the session its claim stamp (`arggon-claim.json` in the worktree's git dir) names — the delivery lead owns the item, the maker owns the worktree while the claim lives; no session writes in a worktree another live session holds.
- Notice: the attach-time single-writer observation the start receipt carries (`claim.foreignWrites`: stamped owner, claim time, newer files) plus the stamp itself; `arggon doctor` reports the surrounding repo/tracker state, not per-worktree stamps (verified against `doctor --json`: docs/tracker/git/envGitignore/opencode/matrix — no stamp enumeration).
- Resolution: the stamped owner first (re-attach refreshes the stamp); dead owner → the lead via `start --worktree --take-over-worktree` (audited) or the manual `rm <git-dir>/arggon-claim.json` escape hatch — never a hand-write into another live session's worktree; recovery and merge-prep writes after that session has ended stay the lead's call.
- Standing decision: the strict refusal remains unarmed by deliberate choice (decision comment 2026-10-15); this rule is the coordination discipline in its place.

**Gates — expected vs observed (run in the worktree, final bytes)**

- `npm run arggon -- validate` → expected ok; observed `ok (0 warning(s), convention v5)`.
- `npm run build` → needed for the fresh worktree (`dist/cli.js` absent; `headless-ci.test.ts` requires it); observed clean build, `git status` afterwards showed only `ArggonManager/docs/agents.md`.
- `npm test` → observed `160 passed (160)` files, `3541 passed (3541)` tests.
- `npm run lint` → observed exit 0.
- `npm run test:structure` → observed `5 passed; 0 failed`.
- `npx prettier --check ArggonManager/docs/agents.md` → observed clean.

**Not done / not applicable:** boxes 2–3 (the "if armed" branch: config line + refused-attach evidence) do not apply under the recorded keep-report-only decision; box 1 is the lead's recorded decision comment. No acceptance ticks changed in the item body — completion is the delivery lead's call.

### handoff 2026-10-15 @arggon-maker — next: Delivery lead: review PR #842 (docs-only, one file, all gates green), merge it, then flip the item to done per the recorded keep-report-only decision.
- branch: feat/task-arm-strict-worktree-writes
- open questions: none; the sibling branch edits agents.md §Claim, so a trivial merge is expected

### 2026-10-15 @arggon-maker
Follow-up (post-rebase) — the branch was rebased onto `origin/main` (`39a6d3da`) to drop one inherited unpushed tracker commit (`2b9b6f94`, the `bug-prover-agent-has-no-x-generated-entry` prune — an unrelated item riding the claim branch's cut point), then force-pushed with lease. The docs commit is now `2ece8559` (was `89d5dc17` before the rebase; the tree is byte-identical apart from the dropped unrelated file). PR #842 now carries only the two in-scope files: `ArggonManager/docs/agents.md` and this item file. No gate results changed; `validate` re-run green after the rebase.
