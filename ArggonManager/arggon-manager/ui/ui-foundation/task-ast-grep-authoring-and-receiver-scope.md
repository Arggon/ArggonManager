---
type: task
status: done
id: task-ast-grep-authoring-and-receiver-scope
title: Clarify ast-grep authoring constraints and receiver-name scope
assignee: Arggon
branch: feat/task-ast-grep-authoring-and-receiver-scope
parent: ui-foundation
labels: [tooling, architecture, review-followup]
priority: p3
created: "2026-09-28"
updated: "2026-09-30"
depends_on: [task-ast-grep-structural-rules]
worktree_path: /home/arggon/Projects/ArggonManager-task-ast-grep-authoring-and-receiver-scope
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

<!-- Ticked against the PR branch 2026-09-30; evidence in the review comment. -->

- [x] Reproduce the sibling `$$$` behavior with the pinned `@ast-grep/cli` and rewrite the authoring note with the exact supported constraint and a minimal example.
- [x] Document receiver-name sensitivity as an explicit limitation, or add a high-confidence rule/test for alternate canonical receiver names without reintroducing generic-name false positives.
- [x] Keep the high-confidence scope and documented limitations accurate; no exhaustive-semantic-enforcement claim.
- [x] Rule tests, `lint:structure`, full test/lint/build/`check:plugin`/validate remain green.

## Notes

Non-blocking findings from the final lead-architect review of PR #418, 2026-09-28. Depends on the guard item so the follow-up starts from the merged rule baseline.

### 2026-09-30 @Arggon
Follow-up verdict (2026-09-30, @Arggon): all four acceptance boxes ticked on the PR branch (833ca326 + merge adde8fca).

Empirical reproduction on @ast-grep/cli@0.45.3 (pinned binary, scratch sgconfig with the repo's languageGlobs): the old authoring note was over-generalized. Verified semantics: (1) several distinct sibling $$$ patterns in one 'any' all fire — the merged native rule itself is the in-repo proof; (2) a metavariable name repeated across 'any' branches does NOT unify (alpha($VAL)/beta($VAL,$OTHER) both fire); (3) inside one 'all', a name repeated across sibling patterns is an EQUALITY constraint — fires only on identical text (pinned: $RECEIVER.add($$$ARGS)+editor.add($$$ARGS) fires exactly on editor.add calls) and silently produces an empty match set on mismatch (pinned: transform($$$CALL)+editor.add($$$CALL) never fires on the nested call). The note in tools/ast-grep/README.md now states exactly this with both minimal examples.

The repro is permanent: cli/src/ast-grep-authoring.test.ts shells out to the pinned binary (same shape as the plugin type gate) and pins all four facets.

Receiver-name scope: documented as an explicit limitation (README § Documented native limitations + the rule's note field) — generic $X.add shapes would reintroduce the generic-name false positives the guard exists to avoid — and pinned by a toolEditor.add case in the rule suite's valid snippets. No exhaustive-semantic-enforcement claim; schema/parity tests stay authoritative.

Gates: test:structure 3/3, lint:structure clean, npm test 108 files / 1784 tests, lint, build, check:plugin (no drift), validate ok:true, prettier clean. Deviation note: the remote branch received a main-merge (030be998) mid-flight from another session; merged cleanly (adde8fca), no force-push.

### handoff 2026-09-30 @Arggon — next: Coordinator: review/merge PR #479 (docs+tests only); flip the item to done after merge.
- branch: feat/task-ast-grep-authoring-and-receiver-scope
- open questions: Equality-unification semantics now pinned by test; if ast-grep is upgraded past 0.45.3, re-run cli/src/ast-grep-authoring.test.ts first
