---
type: task
status: done
id: task-cleanup-probe-degradation-honesty
title: "cleanup's probe-degradation fallback still prints removable: true then fails raw when `git status` cannot run — the classification-honesty rule's last unmigrated path (reviewer N1 on PR #751)"
assignee: arggon-delivery-lead
branch: feat/task-cleanup-probe-degradation-honesty
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, hygiene, review-followup]
created: "2026-10-12"
updated: "2026-10-15"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-cleanup-probe-degradation-honesty.md
  Leaves live only under a story. id is the filename stem: task-cleanup-probe-degradation-honesty.
  CLI `arggon create task cleanup-probe-degradation-honesty` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup's probe-degradation fallback still prints removable: true then fails raw when `git status` cannot run — the classification-honesty rule's last unmigrated path (reviewer N1 on PR #751)

## Context

Standards-review finding N1 on PR #751
(`bug-cleanup-prune-untracked-artifacts-no-force`), 2026-10-12: the new
classification-honesty rule ("if the tool will not remove it, it must not print
`removable: true` with a null reason") covers the normal path, but the
**probe-degradation fallback** (`lib/src/cleanup.ts` ~line 430) keeps the old
shape: when the `git status --porcelain` probe cannot run, the entry is still
classified `removable: true` and the removal then fails with a raw git error —
the classify/act mismatch the parent item removed for every other path.

Reachable only for an already-broken worktree (probe failure), which is why it
was not blocking; recorded so the rule does not have a silent exception.

## Acceptance

- [x] On the degradation path, either classify `removable: false` with a reason
      naming the failed probe and the manual remedy, or carry the same honest
      `action: "failed"` shape with the manual sequence — decide and record why
- [x] A test pins the degradation path's shape (injected failing probe), so the
      honesty rule is total rather than path-dependent
- [x] The normal paths and their tests are untouched

## Notes

### 2026-10-15 @arggon-maker

Decision: classify `removable: false` with a reason naming the failed probe and the manual remedy — NOT the `action: "failed"` receipt shape.

- Rationale: the porcelain probe is the only evidence that `git worktree remove` will succeed, so an unanswered probe must not print `removable: true` with a null reason; the failed-receipt shape would need CLI/native surface changes (outside this item's kernel scope) and would still leave the candidates list promising a removal the tool cannot verify. The path is reachable only for an already-broken worktree (git's own removal check runs the same probe), so refusing loses nothing — the old shape ended in a raw error and an identical retry. `--force` does not bypass: force discards untracked content a WORKING probe observed; an unanswered probe observed nothing.
- After: `removable: false`, `action: null`, reason names the probe (`'git status --porcelain' in <path> did not answer`), the inspection command (`git -C <path> status --porcelain`) and the manual sequence (`git worktree remove <path>` — `--force` only for inspected, disposable content; `git branch -D <branch>`; re-run `arggon cleanup --prune` to clear the record).

Evidence (worktree, all green):

- `npm run arggon -- validate` → ok (0 warnings).
- `npx vitest run lib/src/cleanup.test.ts` → 11 passed (3 new: injected failing probe ⇒ removable:false + reason + action null; force does not bypass; answering probe ⇒ clean path unchanged).
- `npm test` (after `npm run build`) → 158 files / 3484 tests passed.
- `npm run lint`, `npm run test:structure` (5 passed), `npx prettier --check` on touched files → green.

Files: `lib/src/cleanup.ts`, `lib/src/cleanup.test.ts`, `lib/src/worktree.property.test.ts` (1-line probe injection, delivery-lead-approved: its tmp worktree is not a git repo, so the real probe never answered and the harness silently depended on the pre-fix degradation), `opencode/plugins/arggon/index.bundle.ts` (regenerated; plugin-copy drift gate requires it).

PR #832 (branch pushed). Acceptance: (1) decided + recorded here and in the PR body; (2) pinned by an injected failing probe; (3) normal-path behavior unchanged — the only existing-test edit is the disclosed 1-line probe injection. Boxes left for the lead's completion call.

### handoff 2026-10-15 @arggon-maker — next: Review and merge PR #832, then tick the 3 acceptance boxes and flip to done. Optional docs line for the probe-failure skip in agents.md §Cleanup / json-output.md §cleanup left to you.

- branch: feat/task-cleanup-probe-degradation-honesty
- open questions: Docs mention of the probe-failure skip left to the lead (out of kernel scope); property-test harness injection approved by the lead and disclosed in the PR.

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx

verdict: approve

### Lead review + merge verification — 2026-10-14 (delivery lead)

Merged as 7841ff4a (PR #832). Decision: an unanswered removal-blocker probe classifies the entry `removable: false` with a reason — not the `action: "failed"` receipt shape (that would need CLI/native surface changes, would still leave the candidates list promising a removal the tool cannot verify, and the path is reachable only for an already-broken worktree). The refusal names the failed probe, the inspection command and the manual sequence; `--force` does not bypass it (force discards content a WORKING probe observed; an unanswered probe observed nothing). The answering-probe path is behavior-equivalent (early-return refactor, no logic change).

Good catch folded in: the property-test harness now answers the porcelain probe explicitly — its ambient tmp worktree is not a git repo, so the property had silently depended on the pre-fix degradation. Bundle regenerated for the drift gate. Evidence: `cleanup.test.ts` +3 (injected failing probe; force does not bypass; answering-probe control), property harness injection, full suite 3484 green, CI green on all lanes.
