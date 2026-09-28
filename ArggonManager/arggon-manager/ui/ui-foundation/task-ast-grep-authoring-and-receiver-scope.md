---
type: task
status: todo
id: task-ast-grep-authoring-and-receiver-scope
title: Clarify ast-grep authoring constraints and receiver-name scope
parent: ui-foundation
labels: [tooling, architecture, review-followup]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
depends_on: [task-ast-grep-structural-rules]
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ast-grep-authoring-and-receiver-scope.md
  Leaves live only under a story. id is the filename stem: task-ast-grep-authoring-and-receiver-scope.
  CLI `arggon create task ast-grep-authoring-and-receiver-scope` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Clarify ast-grep authoring constraints and receiver-name scope

## Context

Final review of PR #418 passed the high-confidence ast-grep guard and identified two documentation/maintenance gaps that are real but non-blocking for that merge:

1. The README/PR authoring note says only the last sibling `$$$ARGS` pattern in one `any` is effective. The reviewer observed several distinct sibling `$$$` patterns firing in the same scan, so the constraint is narrower (likely constrained sibling metavariables) than the note claims. The over-generalized note could cause a maintainer to refactor working rules incorrectly.
2. The native rule anchors the canonical receiver name `editor`; a differently named but type-valid receiver such as `toolEditor.add(extraTool)` is not covered. The plugin schema/parity test currently mitigates this, but the documented native limitations mention handle indirection only.

## Acceptance

- [ ] Reproduce the sibling `$$$` behavior with the pinned `@ast-grep/cli` and rewrite the authoring note with the exact supported constraint and a minimal example.
- [ ] Document receiver-name sensitivity as an explicit limitation, or add a high-confidence rule/test for alternate canonical receiver names without reintroducing generic-name false positives.
- [ ] Keep the high-confidence scope and documented limitations accurate; no exhaustive-semantic-enforcement claim.
- [ ] Rule tests, `lint:structure`, full test/lint/build/`check:plugin`/validate remain green.

## Notes

Non-blocking findings from the final lead-architect review of PR #418, 2026-09-28. Depends on the guard item so the follow-up starts from the merged rule baseline.
