---
type: task
status: in_progress
id: task-spec-analyze-baseline
title: "spec analyze --baseline: persisted findings baseline per wave"
assignee: Arggon
branch: feat/task-spec-analyze-baseline
parent: story-spec-pipeline
labels: [p2]
created: "2026-09-16"
updated: "2026-09-16"
claimed_at: "2026-09-16T21:25:45.567Z"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-analyze-baseline.md
  Leaves live only under a story. id is the filename stem: task-spec-analyze-baseline.
  CLI `arggon create task spec-analyze-baseline` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec analyze --baseline: persisted findings baseline per wave

## Context

Rollout step 3 of the spec-corpus migration proposal: during the ArggonStores-am refactor, "spec analyze without NEW findings vs baseline" was enforced by MANUAL JSON diffing across waves. `spec analyze --baseline <file>` persists the findings snapshot so the gate is verifiable per PR/wave. Complements task-spec-audit (the audit FINDS duplication; the baseline GATES analyze findings). Effort S-M.

## Acceptance

- [ ] `arggon spec analyze --baseline <file>`: compares current findings against a persisted baseline snapshot; reports only NEW findings (and resolved ones); exit code policy documented (new findings = non-zero? flag-controlled) — decide + document
- [ ] `--save-baseline <file>` (or analyze --out) writes the snapshot (deterministic ordering so diffs are meaningful)
- [ ] Tests: baseline round-trip, new-finding detection, resolved-finding reporting, deterministic ordering; docs/json-output + README additive
- [ ] The ArggonStores-am-style wave gate becomes: save-baseline once, assert no-new per wave — documented in README as the recommended flow

## Notes
