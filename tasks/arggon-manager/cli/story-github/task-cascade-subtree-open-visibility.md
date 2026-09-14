---
type: task
status: in_progress
id: task-cascade-subtree-open-visibility
title: "cascade: record subtree-open skip reason; auto-done re-checkout before flip loop"
assignee: Arggon
branch: feat/task-cascade-subtree-open-visibility
parent: story-github
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T19:58:29.343Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/task-cascade-subtree-open-visibility.md
  Leaves live only under a story. id is the filename stem: task-cascade-subtree-open-visibility.
  CLI `arggon create task cascade-subtree-open-visibility` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cascade: record subtree-open skip reason; auto-done re-checkout before flip loop

## Context

Lead-architect review findings on task-auto-done-cascade-visibility (PR #178),
both directly from the root-cause analysis of the missed
story-cli-ergonomics cascade:

1. When `autoCompleteAncestors` (cli/src/update.ts) stops the walk because a
   SIBLING is still non-terminal, `cascadeSkipped` stays empty — the only
   recorded reason is `acceptance-incomplete`. The stop is silent at the CLI
   level and shows up in auto-done logs only as an empty cascade list. A
   `subtree-open` reason naming the blocking sibling would make such
   incidents self-explaining (task-auto-done-cascade-visibility's Notes
   suggest the same).
2. The auto-done workflow checks out `ref: main` at run START; a sibling's
   flip PR merging minutes later is invisible to the flip loop (the exact
   race that hit PR #172 / #171). Re-fetching and re-checking out main
   immediately before the flip loop shrinks the window.

## Acceptance

- [ ] `autoCompleteAncestors` records a `subtree-open` skip (with the blocking sibling id) in `cascadeSkipped`; additive payload change, test in cascade.test.ts
- [ ] The auto-done workflow re-fetches/re-checks out main immediately before the flip loop
- [ ] docs/json-output.md documents the new cascadeSkipped reason additively

## Notes
