---
type: task
status: in_progress
id: task-code-span-repair-sweep
title: "Code-span repair sweep: remaining glued/indent-lost spans in docs"
assignee: Arggon
branch: feat/task-code-span-repair-sweep
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-22"
claimed_at: "2026-09-22T00:31:47.432Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-code-span-repair-sweep
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-code-span-repair-sweep.md
  Leaves live only under a story. id is the filename stem: task-code-span-repair-sweep.
  CLI `arggon create task code-span-repair-sweep` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Code-span repair sweep: remaining glued/indent-lost spans in docs

## Context

Follow-up from `bug-formatter-glues-markdown-spaces` (PR #387). The root cause
(`` \` `` is not a valid escape inside a CommonMark code span, so the parser
splits the span and prettier drops the surrounding whitespace) still affects
docs outside that PR's scope:

- **Indentation variant** in
  `ArggonManager/docs/explorations/exploration-{adopter-upgrade-experience-007,priority-model-008,torture-contention-005}.md`,
  `ArggonManager/docs/plans/plan-spec-pipeline-002.md`,
  `ArggonManager/docs/specs/spec-{priority-field-008,spec-pipeline-002}.md`,
  `ArggonManager/docs/playbooks/{node,vitest}.md`.
- **Token glues** quoted as evidence in tracker items
  (`task-native-lib-hygiene`, `bug-seam-signature-anchor-regressed`).

Repair requires re-encoding each span (restoring whitespace alone is not
enough: prettier deletes it again).

## Acceptance

- [ ] Every affected doc span re-encoded (double-backtick delimiters or a
      valid alternative) so it parses as one span with the intended text.
- [ ] `prettier --check` clean and `prettier --write` a no-op on the repaired
      files; the `prose-format` guard covers them (or documents the exclusions).
- [ ] Tracker-item evidence quotes left as-is (body-only history) with a note,
      or repaired without altering meaning.
- [ ] `arggon validate` green; CI green.

## Notes

- Filed from the PR #387 handoff; cosmetic but recurring (the formatter
  auto-runs on every edit in this repo).
