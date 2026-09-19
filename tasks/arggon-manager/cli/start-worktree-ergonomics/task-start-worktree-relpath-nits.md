---
type: task
status: done
id: task-start-worktree-relpath-nits
title: "Worktree-start nits: relative-link resolution + manual npm-ci guard"
assignee: Arggon
branch: feat/task-start-worktree-relpath-nits
parent: start-worktree-ergonomics
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-19"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/start-worktree-ergonomics/task-start-worktree-relpath-nits.md
  Leaves live only under a story. id is the filename stem: task-start-worktree-relpath-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Worktree-start nits: relative-link resolution + manual npm-ci guard

## Context

Residual, non-blocking findings from the two-round review of PR #333
(`bug-start-worktree-node-modules`).

- **R1 — relative-link resolution.** `unlinkNodeModulesLink` resolves a
  *relative* symlink target against `process.cwd()` instead of the link's
  directory. Start's own links are absolute so the F1 fix is unaffected, and
  the miss direction is safe (cleanup then reports the git refusal), but a
  relative link pointing at the primary is only removed when the command runs
  from the primary directory. Fix: `resolve(dirname(link), readlinkSync(link))`
  + a relative-link unit case.
- **R2 — manual `npm ci` after a re-link.** A *manual* `npm ci` in a worktree
  where start re-created the link (no hook, or a hook that left no deps) can
  still empty the primary install; `docs/convention.md` now warns explicitly.
  Optional: an automated guard (marker file next to the link) that unlinks
  before npm can reify, or a stronger warning.
- **R3 — nested-worktree primary detection.** After the F2 fix merged,
  `arggon cleanup --prune` run from `ArggonManager-opencode2` pruned 21
  worktrees but failed on 6 merged item worktrees created *from that worktree*:
  their `node_modules` links point at the **main** checkout
  (`/home/arggon/Projects/ArggonManager/node_modules`), while cleanup resolves
  the link-ownership "primary" from the worktree it runs in, so the start link
  is not recognized/removed and `git worktree remove` refuses ("contains
  modified or untracked files" — the untracked symlink). Repro: run
  `arggon cleanup --prune` from a linked worktree whose item worktrees carry
  main-checkout links. Fix: resolve the canonical/main worktree (e.g. first
  `git worktree list` entry) as the ownership target, not the current root.

## Acceptance

- [x] R1 fixed with a relative-link unit case; foreign links and real dirs
      still untouched.
- [x] R2 decided: automated guard implemented with a test, or the documented
      warning kept and explicitly accepted in this item (rationale recorded).
- [x] R3 fixed: `cleanup` recognizes start links that point at the main
      checkout when it runs from a linked worktree; nested case covered by a
      test (the 6 pending worktrees from the program then prune cleanly).
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Both are fail-safe nits; the bug fix and its regression tests are merged.

### 2026-09-18 @Arggon
R2 decision (worker note): keep the documented warning and explicitly accept the residual manual-`npm ci` risk; no automated guard.

Rationale:
1. The sanctioned path is already guarded: `start` removes the link before any configured `x-worktree.post-start` hook runs and re-links only when the hook leaves no `node_modules`, so the canonical `post-start: "npm ci"` can never reify through a link. The residual case is a *manual* `npm ci` in a worktree whose link start re-created (no hook configured, or a hook that left no deps).
2. A bare marker file is inert — npm only executes project code through a lifecycle hook (`preinstall`), so "unlink before npm can reify" requires wiring one into the repo's `package.json`. That file is outside this item's file ownership and would impose an install-time code path on every checkout for a narrow manual case.
3. The documented warning (docs/convention.md, `x-worktree` / "Worktree bootstrap") names the case explicitly and the mitigation is one command: `rm <worktree>/node_modules` before `npm ci`. `cleanup --prune` also removes such links when reaping worktrees (F2 / this item's R3).
4. The failure mode is loud and recoverable (`npm ci` in the primary restores it), and the review classified R2 as optional / non-blocking.

Evidence: the guarded hook path stays covered by cli/src/worktree.test.ts "hides the link from a configured post-start hook so npm ci cannot empty the primary" and "re-links after a post-start hook that leaves no node_modules".

### handoff 2026-09-18 @Arggon (session: ses_f4a703667ffeIQ4WdhWlBCLWGa) — next: Review draft PR #351 and the R2 rationale comment; after merge, run cleanup --prune from the linked worktree to prune the 6 pending items and flip this item done.
- branch: feat/task-start-worktree-relpath-nits
- open questions: Branch is feat/task-start-worktree-relpath-nits (task -> feat pattern), not the fix/... name in the brief; R3 verified on a fixture, not the live 6 program worktrees.

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; R1 dirname-relative resolution verified (absolute/real-dir/foreign-relative untouched), R3 dual-root ownership safe (only a link resolving exactly to the current or canonical-main install, inside a registered worktree) with an independent pre-fix control failing exactly as reported and an 11/11 nested fixture smoke (alpha→main and two-hop bravo→linked pruned, relative foreign kept, installs intact), R2 decision recorded with rationale; 1206 tests + CI green; merged. Pre-existing show leak is tracked in task-show-fixture-cleanup (PR #350) and the two-hop unit case is optional. Closing.
