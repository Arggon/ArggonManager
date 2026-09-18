---
type: task
status: todo
id: task-start-worktree-relpath-nits
title: "Worktree-start nits: relative-link resolution + manual npm-ci guard"
priority: p3
parent: start-worktree-ergonomics
labels: []
created: "2026-09-18"
updated: "2026-09-18"
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

## Acceptance

- [ ] R1 fixed with a relative-link unit case; foreign links and real dirs
      still untouched.
- [ ] R2 decided: automated guard implemented with a test, or the documented
      warning kept and explicitly accepted in this item (rationale recorded).
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Both are fail-safe nits; the bug fix and its regression tests are merged.
