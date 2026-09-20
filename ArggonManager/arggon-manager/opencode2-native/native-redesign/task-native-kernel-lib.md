---
type: task
status: in_progress
id: task-native-kernel-lib
title: Kernel as a library
assignee: Arggon
branch: feat/task-native-kernel-lib
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T05:57:37.025Z"
depends_on: [task-native-layout-rename]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-kernel-lib
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-kernel-lib.md
  Leaves live only under a story. id is the filename stem: task-native-kernel-lib.
  CLI `arggon create task native-kernel-lib` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Kernel as a library (W1)

## Context

W1 of `plan-native-first-011` (spec `native-first-011`). Extract the kernel from `cli/src` into an importable library entry with a stable typed API (items, rules, paths, `--json` envelopes); the CLI consumes it, behavior and envelopes unchanged. ADR 0011 decision 4: one logic path, one library.

## Acceptance

- [ ] The library imports from a clean build (`npm run build`) and exposes the kernel entrypoints the tools need.
- [ ] The full test suite (1311+) stays green; CLI human/`--json` output is byte-identical on the existing fixtures.
- [ ] No rule logic moves outside the kernel; `rules.ts` remains the single source.
- [ ] `arggon validate` green; no user-facing behavior change.

## Notes

- Gates W2 (`task-native-tools`) and W6 (`task-native-headless-ci`).
