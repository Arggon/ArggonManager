---
type: task
status: todo
id: task-closes-issue-linking
title: "Issue-to-PR linking: Closes #N with issue number in frontmatter"
parent: story-tracker-hygiene
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/task-closes-issue-linking.md
  Leaves live only under a story. id is the filename stem: task-closes-issue-linking.
  CLI `arggon create task closes-issue-linking` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Issue-to-PR linking: Closes #N with issue number in frontmatter

## Context

`import-issues` records provenance only in the task body ("imported from issue #N"), so the adoption agent had to hand-write "Closes #N" in every PR body. Design: import writes the issue number into the item (frontmatter field `issue: number` — additive, or namespaced x-import), and `start --open-pr` includes `Closes #N` in the PR body when the item carries it.

## Acceptance

- [ ] import-issues records the issue number on the item (contract-visible); migrate: items without it are unaffected
- [ ] start --open-pr appends "Closes #N" to the PR body when the claimed item carries an issue number
- [ ] Tests: import -> item.issue set; start --open-pr body contains Closes #N; items without issue unaffected
