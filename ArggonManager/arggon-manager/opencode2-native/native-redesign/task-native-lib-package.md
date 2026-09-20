---
type: task
status: in_progress
id: task-native-lib-package
title: "Kernel package: @arggon/lib (ADR 0013)"
assignee: Arggon
branch: feat/task-native-lib-package
parent: native-redesign
labels: []
priority: p0
created: "2026-09-20"
updated: "2026-09-20"
claimed_at: "2026-09-20T10:45:12.790Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-lib-package
---

<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-native-lib-package.md
  Leaves live only under a story. id is the filename stem: task-native-lib-package.
  CLI `arggon create task native-lib-package` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Kernel package: @arggon/lib (ADR 0013)

## Context

Product-owner decision (2026-09-20), amending ADR 0011 §5: the kernel ships as
a **separate package `@arggon/lib`**, not as a subpath export of the root
package. The root package (`arggon-manager`) ships the plugin build + headless
bin and depends on `@arggon/lib`.

W1 (`task-native-kernel-lib`) landed the library as `arggon-manager/lib`
(subpath export, root `private: true`). This task restructures it into its own
package and absorbs the W1 review polish (`task-native-kernel-lib-polish`).

## Acceptance

- [x] `@arggon/lib` package (workspace layout, own package.json/build/exports)
      containing the kernel surface (items, rules, paths, envelopes); the root
      package depends on it via the workspace; no behavior change.
- [x] Root bin/plugin build still green; CLI human/`--json` byte parity
      preserved by the existing parity tests.
- [x] ADR 0013 merged (Accepted) amending ADR 0011 §5; `spec-native-first-011`
      Distribution updated (two packages; the vendored plugin stays a
      single-file, dependency-free bundle built from `@arggon/lib`); plan note.
- [x] W1 polish absorbed: MCP `issueRoundtrip`/`conventionVersion` test or
      documented contract; write-parity cases (create, cascade update,
      comment/handoff); re-exports (`PriorityMigrateOptions`, `SyncFilled`) with
      no deep imports left in `mcp-server.ts`; clean-build test deletes `dist`
      first; stable export subset documented.
- [x] Full suite + lint + build + `arggon validate` + `arggon spec validate`
      green; CI green.

## Notes

- Blocks W2 (`task-native-tools`), which consumes the package.
- `task-native-kernel-lib-polish` was cancelled as absorbed.
