---
type: task
status: in_progress
id: task-author-parallel-worktree-bodies
title: Author bodies for the parallel-worktree story and its 4 placeholder tasks
assignee: arggon-delivery-lead
branch: feat/task-author-parallel-worktree-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T01:42:28.636Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-author-parallel-worktree-bodies
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-parallel-worktree-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-parallel-worktree-bodies.
  CLI `arggon create task author-parallel-worktree-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author bodies for the parallel-worktree story and its 4 placeholder tasks

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `parallel-worktree-runtime-isolation-ports-state-services (story file + 4 tasks)`: task-arm-strict-worktree-writes, task-clip-class-sweep-remaining-sites, task-cli-surface-never-carries-steps-truncated, task-foreign-writes-char-clip-truncated. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean; `arggon validate` green; PR opened

## Notes
