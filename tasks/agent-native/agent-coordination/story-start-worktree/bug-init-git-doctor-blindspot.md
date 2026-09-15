---
type: bug
status: in_progress
id: bug-init-git-doctor-blindspot
title: init in a non-git dir yields a half-functional tracker; doctor reports all-healthy
assignee: Arggon
branch: fix/bug-init-git-doctor-blindspot
parent: story-start-worktree
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T13:00:19.106Z"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/bug-init-git-doctor-blindspot.md
  Leaves live only under a story. id is the filename stem: bug-init-git-doctor-blindspot.
  CLI `arggon create bug init-git-doctor-blindspot` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init in a non-git dir yields a half-functional tracker; doctor reports all-healthy

## Context

Feedback from the vencimientos adoption experiment (2026-09-15 session): the agent ran `arggon init` in a fresh directory with NO git repo. Init generated the full governance set (AGENTS.md, docs, tracker) and auto-commit skipped gracefully ("not a git repository" — by design, the CLI works without git). But `arggon doctor` reported everything healthy while the actual loop was half-broken: branch, worktree, tracker auto-commit, push, PR and the pre-commit `arggon validate` hook all depend on git. The agent had to `git init`, create the hook manually and open the GitHub repo before claiming the first item.

Doctor is exactly the report-only surface where this belongs: it already reports docs/tracker health, just not git state.

## Acceptance

- [x] `doctor --json` reports git state: is-repo, dirty/clean, remote present (report-only, exit 0 as always)
- [x] `init` warns on stderr when generating in a non-git tree (branch/worktree/push/PR flows unavailable; auto-commit skipping is expected) — do NOT auto-`git init` (design decision explicitly out of scope for this bug)
- [x] Tests: doctor on a non-git tree reports the git state; init-in-non-git emits the warning

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. Doctor now answers the question it was asked in vencimientos (is this tree actually usable for the full loop?) without breaking its report-only charter; the init warning rides stderr + additive JSON field following existing conventions; no auto-git-init scope creep. Tests cover both trees. Merge follows.
