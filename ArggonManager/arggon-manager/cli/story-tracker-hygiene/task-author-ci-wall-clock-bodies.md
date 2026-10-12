---
type: task
status: todo
id: task-author-ci-wall-clock-bodies
title: Author bodies for the ci-wall-clock story and its 2 placeholder tasks
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-ci-wall-clock-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-ci-wall-clock-bodies.
  CLI `arggon create task author-ci-wall-clock-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author bodies for the ci-wall-clock story and its 2 placeholder tasks

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `story-ci-wall-clock (story file + 2 tasks)`: task-ci-concurrency-cancel, task-ci-shard-wall-measure. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean; `arggon validate` green; PR opened

## Notes

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT
verdict: approve (ci-wall-clock story + 2 tasks, docs-only, smoke-exempt)
- Read the worktree diff (3 files + own item file) — nothing else; scope stays on the item
- Standards-reviewer: approve, no blocking findings (frontmatter identical; Notes→live transcription verbatim incl. box sets; ADR 0023 pins resolve at HEAD; boxes checkable; own boxes unticked)
- Verifier: validate ok; prettier red ONLY on the author's own item file (targets clean) → lead fixed with prettier --write (blank lines only, 3 insertions), re-ran probe green + validate green in the worktree
- Recommendation: merge PR #734 (merge, not squash) on green CI; lead ticks Acceptance after merge and flips done
