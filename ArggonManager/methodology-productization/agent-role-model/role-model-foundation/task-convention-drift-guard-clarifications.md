---
type: task
status: in_progress
id: task-convention-drift-guard-clarifications
title: "Convention option-drift guard clarifications: marker scoping, mismatch message, duplicate-dispatch hazard"
assignee: arggon-delivery-lead
branch: feat/task-convention-drift-guard-clarifications
parent: role-model-foundation
labels: [tests, docs, cli]
created: "2026-10-13"
updated: "2026-10-13"
claimed_at: "2026-10-13T14:34:51.468Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-convention-drift-guard-clarifications
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-convention-drift-guard-clarifications.md
  Leaves live only under a story. id is the filename stem: task-convention-drift-guard-clarifications.
  CLI `arggon create task convention-drift-guard-clarifications` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Convention option-drift guard clarifications: marker scoping, mismatch message, duplicate-dispatch hazard

## Context

Three non-blocking notes from the standards review of `bug-x-tracker-option-list-has-no-doc-drift-guard` (merged as PR #759): (a) the `undocumented-by-design` marker is line-scoped (`line.includes(marker)`) rather than branch-scoped — the doc says "on its parse branch" without saying the branch's first line; (b) a marked-but-doc-mismatched boolean reads as a kernel mismatch, so the failure message can misattribute; (c) `readKernelSections` keys sections by name and `sections.set` overwrites, so a future duplicate dispatch would drop the first block's keys — currently fail-loud via the one-branch-per-option assertion.

## Acceptance

- [ ] convention.md + the suite message state the marker's exact scope (line-level, and which line)
- [ ] the mismatch message distinguishes "kernel has an extra option" from "doc names an option the kernel lacks"
- [ ] the duplicate-dispatch hazard is impossible or pinned by an explicit test/comment
- [ ] `npx vitest run cli/src/convention-option-doc-contract.test.ts` green; `arggon validate` ok

## Notes
