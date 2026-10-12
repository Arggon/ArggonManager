---
type: task
status: in_progress
id: task-author-harness-transfer-bodies
title: Author bodies for the 3 placeholder tasks under harness-research-transfer and external-harness-evaluation
assignee: arggon-delivery-lead
branch: feat/task-author-harness-transfer-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T02:15:08.193Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-author-harness-transfer-bodies
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-harness-transfer-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-harness-transfer-bodies.
  CLI `arggon create task author-harness-transfer-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author bodies for the 3 placeholder tasks under harness-research-transfer and external-harness-evaluation

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `harness-research-transfer + external-harness-evaluation`: task-adopt-compaction-three-questions, task-state-exploration-stopping-rule, task-spike-cross-run-lesson-store. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean; `arggon validate` green; PR opened

## Notes
