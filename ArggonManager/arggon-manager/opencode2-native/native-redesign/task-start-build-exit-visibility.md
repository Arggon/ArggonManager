---
type: task
status: in_progress
id: task-start-build-exit-visibility
title: start build-exit visibility + symlink-fallback docs
assignee: Arggon
branch: feat/task-start-build-exit-visibility
parent: native-redesign
labels: []
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
claimed_at: "2026-09-22T00:31:48.532Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-start-build-exit-visibility
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-start-build-exit-visibility.md
  Leaves live only under a story. id is the filename stem: task-start-build-exit-visibility.
  CLI `arggon create task start-build-exit-visibility` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# start build-exit visibility + symlink-fallback docs

## Context

Low findings from the PR #388 review (`task-start-worktree-lib-resolution`):

1. The build exit is ignored (`lib/src/worktree.ts:450-457,488-489`): a build
   that fails but still emits `dist/index.js` (tsc without `noEmitOnError`) is
   reported "built" and flips, while the docs (`json-output.md:418`,
   `pitfalls.md:78`) say "a failed build falls back visibly". Honor the exit or
   precise the docs (the gate still fails loudly if the kernel is broken).
2. `README`/`docs/agents.md` describe always the farm and omit the bare-symlink
   fallback (which `json-output`/skill do document).
3. Attach with a previous install runs the local build even when there is no
   farm to flip (~2s).

## Acceptance

- [ ] Build failure semantics match the docs (exit honored, or the wording
      corrected), with a test for the failing-build-emits-dist case.
- [ ] README/agents mention the bare-symlink fallback.
- [ ] The attach-with-previous-install path skips the build when there is no
      farm to flip (or the cost is documented as accepted).
- [ ] `arggon validate` green; CI green.

## Notes

- Filed from the PR #388 review; non-blocking.
