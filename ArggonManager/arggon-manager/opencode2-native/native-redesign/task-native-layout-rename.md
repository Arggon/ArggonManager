---
type: task
status: in_progress
id: task-native-layout-rename
title: "Layout rename: ArggonManager/ root + docs"
assignee: Arggon
branch: feat/task-native-layout-rename
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T00:12:33.377Z"
depends_on: [task-native-layout-decision]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-layout-rename
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-layout-rename.md
  Leaves live only under a story. id is the filename stem: task-native-layout-rename.
  CLI `arggon create task native-layout-rename` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Layout rename: ArggonManager/ root + docs

## Context

Executes ADR 0012 (accepted 2026-09-19): tracker root `tasks/` →
`ArggonManager/`; all product docs under `ArggonManager/docs/`; legacy
auto-detection + migration, no hard break.

## Acceptance

- [x] Kernel/convention: root constant and detection (`paths.ts`), convention
      docs, templates, init seam, doctor/board/CLI/MCP messages updated.
- [x] Legacy `tasks/` auto-detected; the migration command moves the tree and
      docs (idempotent, provenance-safe) and `validate` reports the legacy
      location.
- [x] This repo dogfoods the rename (`tasks/` → `ArggonManager/`, `docs/` →
      `ArggonManager/docs/`) with internal links updated.
- [x] Full suite + lint + `validate` green; convention version bumped with
      migration notes. (CI on PR #371: `cli` pass.)
- [x] No hard break: an existing `tasks/` tree still works until migrated.
- [x] Docs-migration scope pinned before the sweep: `docs/assets`, labs/runbooks,
      root meta-docs, and package `templates/docs/**` are each classified
      (move vs stay).
- [x] Plan frontmatter `spec:` pointer and internal links updated after the
      move.

## Notes

- Blocks W1 (`task-native-kernel-lib`), which extracts the kernel after the
  layout is stable.
