---
type: bug
status: in_progress
id: bug-empty-template-checkbox
title: empty-template-checkbox-blocks-done-gate
assignee: Arggon
branch: fix/bug-empty-template-checkbox
parent: methodology-improvements
labels: []
priority: p2
created: "2026-09-30"
updated: "2026-09-30"
claimed_at: "2026-09-30T23:56:04.514Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-empty-template-checkbox
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-empty-template-checkbox.md
  Leaves live only under a story. id is the filename stem: bug-empty-template-checkbox.
  CLI `arggon create bug empty-template-checkbox` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# empty-template-checkbox-blocks-done-gate

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- Real criteria: the checklist under Notes, below. -->

## Notes

### 2026-09-30 @Arggon

### Repro (2026-09-30, done gate live since #442)

'arggon create' scaffolds '## Acceptance' with a bare '- [ ] ' placeholder line. When the real acceptance checklist is filed via a comment (create has no --body flag), the placeholder stays unchecked. With ADR 0015's done gate, the auto-done flip is then REFUSED (warning annotation, item stays in_progress) even though every real criterion is ticked — hit on task-exploration-decision-records and bug-stale-vendored-plugin-copy today; coordinator had to delete the line and flip manually.

### Candidate fixes

- Kernel: 'acceptanceComplete' ignores checkbox lines with no text (an empty box is not an acceptance criterion) — smallest fix, keeps the gate strict for real criteria.
- Or: 'arggon create' scaffolds '## Acceptance' with no checkbox until one exists.
- Or: both.

### Acceptance checklist

- [x] Empty checkbox lines (no text after the box) never count as unticked criteria in acceptanceComplete — unit test.
- [x] Items whose acceptance lives in a comment flip via auto-done without manual surgery (regression: create item, comment checklist, tick, flip).
- [x] If create scaffolding changes: fixtures + template updated in the same PR.
