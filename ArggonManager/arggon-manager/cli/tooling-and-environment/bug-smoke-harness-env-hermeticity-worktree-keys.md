---
type: bug
status: todo
id: bug-smoke-harness-env-hermeticity-worktree-keys
title: "smoke harnesses clear only `ARGON_ITEM`, so after the tracker-root guard reads `ARGGON_WORKTREE_PATH` a developer who exported the worktree keys will see the model-driven smokes refuse"
parent: tooling-and-environment
labels: [smoke, tests, native-seam]
created: "2026-10-05"
updated: "2026-10-05"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-smoke-harness-env-hermeticity-worktree-keys.md
  Leaves live only under a story. id is the filename stem: bug-smoke-harness-env-hermeticity-worktree-keys.
  CLI `arggon create bug smoke-harness-env-hermeticity-worktree-keys` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# smoke harnesses clear only `ARGON_ITEM`, so after the tracker-root guard reads `ARGGON_WORKTREE_PATH` a developer who exported the worktree keys will see the model-driven smokes refuse

## Context

Found while delivering `bug-native-arggon-tools-resolve-tracker-root-to-session-cwd` (merged 2026-10-05).

That change made the native seam read `process.env` for the worktree identity keys — `ARGON_ITEM`, `ARGGON_WORKTREE_ID`, `ARGGON_WORKTREE_PATH`, `ARGGON_WORKTREE_BRANCH`, and the state/cache dirs. The plugin's own suite (`opencode/plugins/arggon/tools.test.ts`) clears all of them and carries a hermeticity guard against exactly this.

**The sibling harnesses were not updated.** `smoke/opencode-smoke.ts`, `smoke/opencode-wave.ts` and `smoke/context-report.ts` clear **only `ARGON_ITEM`**. On a developer machine that has exported the worktree keys (which `arggon start --worktree` and the README's sourcing pairing encourage), those smokes will drive a seam that now refuses a write (`TRACKER_ROOT_MISMATCH`) or reports a mismatch they never assert — turning an unrelated local export into a confusing red model-driven smoke.

## Acceptance

- [ ] All three harnesses clear the **full** worktree key set (not just `ARGON_ITEM`) before
      driving the seam, so a developer's exported env cannot change a smoke's outcome
- [ ] The key list is derived from one shared constant (the seam's own), so a key added to
      the env contract cannot be missed here again — the failure mode is drift, so the fix
      must not be a second hand-copied list
- [ ] Each harness asserts it is hermetic (a guard test), the way `tools.test.ts` does
- [ ] Proven: with the worktree keys exported in the ambient environment, the harnesses'
      behavior is unchanged — verified by running at least one, alone, per the
      "model-driven and timing sensitive" rule
- [ ] `bug-native-guard-silent-without-worktree-declaration` is considered, since making the
      guard read `process.env` is what made this class of leak matter

## Notes
