---
type: task
status: todo
id: task-native-layout-rename
title: "Layout rename: ArggonManager/ root + docs"
parent: native-redesign
depends_on: [task-native-layout-decision]
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
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

- [ ] Kernel/convention: root constant and detection (`paths.ts`), convention
      docs, templates, init seam, doctor/board/CLI/MCP messages updated.
- [ ] Legacy `tasks/` auto-detected; the migration command moves the tree and
      docs (idempotent, provenance-safe) and `validate` reports the legacy
      location.
- [ ] This repo dogfoods the rename (`tasks/` → `ArggonManager/`, `docs/` →
      `ArggonManager/docs/`) with internal links updated.
- [ ] Full suite + lint + `validate` green; convention version bumped with
      migration notes.
- [ ] No hard break: an existing `tasks/` tree still works until migrated.
- [ ] Docs-migration scope pinned before the sweep: `docs/assets`, labs/runbooks,
      root meta-docs, and package `templates/docs/**` are each classified
      (move vs stay).
- [ ] Plan frontmatter `spec:` pointer and internal links updated after the
      move.

## Notes

- Blocks W1 (`task-native-kernel-lib`), which extracts the kernel after the
  layout is stable.
