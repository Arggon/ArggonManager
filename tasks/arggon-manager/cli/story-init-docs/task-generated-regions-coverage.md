---
type: task
status: done
id: task-generated-regions-coverage
title: "forever-fix coverage: generated SKILL regions for every command"
assignee: Arggon
branch: feat/task-generated-regions-coverage
parent: story-init-docs
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-generated-regions-coverage.md
  Leaves live only under a story. id is the filename stem: task-generated-regions-coverage.
  CLI `arggon create task generated-regions-coverage` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# forever-fix coverage: generated SKILL regions for every command

## Context

Follow-up from the task-schema-budget review (PR #256): the forever-fix (task-skill-generated-command-reference) works mechanically — a command's .description() change regenerates its SKILL region via skills:sync — BUT region coverage is opt-in per filter key. `doctor` was documented only in hand-written SKILL prose, so its description edits silently never fed a generated region; the same applies to init, adopt, branch, start, import-issues and other commands living outside the current region filters (board, report, sync, instructions, cleanup, and now doctor).

## Acceptance

- [x] Coverage invariant: every non-excluded command appears in a generated region (a cross-check test fails when a command is documented only in hand-written prose)
- [x] The remaining hand-written command lines (init, adopt, branch, start, import-issues, etc.) migrate into generated regions (or join the exclusion list with reasons if genuinely internal)
- [x] The forever-fix net is then closed end-to-end: description changes propagate mechanically for ALL user-facing commands

## Notes

- Coverage audit (pre-fix): hand-written-only commands were `init`, `adopt`, `branch`, `import-issues` (start/list/next/etc. and doctor were already in regions). No new exclusions needed — existing list (hello, mcp, spec/stack/playbook groupings) kept with reasons.
- Migration: §1 init/adopt block became a generated region (filter `init,adopt`); curated nuance kept as hand-written bullets outside the region. `branch` joined the §2 work-loop filter; `import-issues` joined the §3 tooling filter. No generator rendering changes needed (init's `[dir]` argument renders fine).
- Coverage invariant lives in cli/src/skill-generated-commands.test.ts (4th test).

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED (deep-validated). I personally probed the invariant: removed 'init' from the region filter -> TWO tests failed (region-stale + the new coverage invariant, with an actionable message naming the fix); restored -> 4/4 green and skills:sync idempotent. The coverage test renders from current source (not the file body), so a stale-but-present region still counts as covered — the right semantics. The spec/stack/playbook subtree staying hand-documented is a conscious exclusion worth revisiting if those surfaces grow. Merge follows.
