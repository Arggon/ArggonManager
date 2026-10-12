---
type: task
status: in_progress
id: task-author-spec-pipeline-body
title: Author body for the placeholder task under story-spec-pipeline
assignee: arggon-delivery-lead
branch: feat/task-author-spec-pipeline-body
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T02:21:16.942Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-author-spec-pipeline-body
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-spec-pipeline-body.md
  Leaves live only under a story. id is the filename stem: task-author-spec-pipeline-body.
  CLI `arggon create task author-spec-pipeline-body` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author body for the placeholder task under story-spec-pipeline

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `story-spec-pipeline`: task-spec-analyze-naming-and-skill-mirror. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean; `arggon validate` green; PR opened

## Notes
