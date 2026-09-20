---
type: bug
status: cancelled
id: bug-skill-copy-untrack
title: ".agents skill copy still tracked — #205 dedup left gitignore as no-op"
parent: story-init-docs
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/bug-skill-copy-untrack.md
  Leaves live only under a story. id is the filename stem: bug-skill-copy-untrack.
  CLI `arggon create bug skill-copy-untrack` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# .agents skill copy still tracked — #205 dedup left gitignore as no-op

## Context

Found 2026-09-14 by the coordinator review of task-review-comments-instruction (PR #209): PR #205 gitignored `.agents/skills/arggon-cli/SKILL.md` but never ran `git rm --cached` on it, so the file stayed TRACKED — the ignore rule is a no-op for already-tracked files and the "single committed source" goal is only half-landed: every `skills:sync` regen shows the copy as a tracked modification, and PR #209 (correctly not staging it) leaves main's tracked copy stale vs the source after merge.

## Acceptance

- [ ] Copy untracked (`git rm --cached .agents/skills/arggon-cli/SKILL.md`; local file kept for skill-reading clients), committed with the removal
- [ ] Parity test still green (it regenerates when absent/mismatched); validate + doctor unchanged (0 modified / 0 drifted / 11 managed)
- [ ] After a skills:sync + a source edit, `git status` shows ONLY the source as modified — the copy no longer appears

## Notes

### 2026-09-14 @Arggon
CANCELLED as invalid on filing verification: the coordinator's check used 'git ls-files <path> && echo TRACKED', but git ls-files exits 0 with no output when nothing matches — the check was defective. Proper verification: 'git ls-files | grep .agents' has no matches (untracked), and PR #205's diff shows the file was removed from tracking. The demanded end-state (untracked copy + gitignore + skills:sync + self-healing parity test) already holds since #205. Keeping the trail honest: this bug documents a defective verification pattern as its own lesson — always grep the full ls-files output, never gate on its exit code.
