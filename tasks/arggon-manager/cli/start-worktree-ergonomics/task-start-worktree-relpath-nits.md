---
type: task
status: in_progress
id: task-start-worktree-relpath-nits
title: "Worktree-start nits: relative-link resolution + manual npm-ci guard"
assignee: Arggon
branch: feat/task-start-worktree-relpath-nits
parent: start-worktree-ergonomics
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T17:28:19.614Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-start-worktree-relpath-nits
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

- [ ] R1 fixed with a relative-link unit case; foreign links and real dirs
      still untouched.
- [ ] R2 decided: automated guard implemented with a test, or the documented
      warning kept and explicitly accepted in this item (rationale recorded).
- [ ] R3 fixed: `cleanup` recognizes start links that point at the main
      checkout when it runs from a linked worktree; nested case covered by a
      test (the 6 pending worktrees from the program then prune cleanly).
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Both are fail-safe nits; the bug fix and its regression tests are merged.
