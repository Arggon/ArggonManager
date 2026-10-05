---
type: bug
status: in_progress
id: bug-native-arggon-tools-resolve-tracker-root-to-session-cwd
title: "Native `tools.arggon.*` resolve the tracker root from the process cwd, so a worker editing a worktree silently commits tracker mutations into the primary checkout (session_move does NOT rebind them)"
assignee: arggon-delivery-lead
branch: fix/bug-native-arggon-tools-resolve-tracker-root-to-session-cwd
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, worktree, hygiene]
created: "2026-10-02"
updated: "2026-10-05"
claimed_at: "2026-10-05T18:50:55.962Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-native-arggon-tools-resolve-tracker-root-to-session-cwd
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-native-arggon-tools-resolve-tracker-root-to-session-cwd.md
  Leaves live only under a story. id is the filename stem: bug-native-arggon-tools-resolve-tracker-root-to-session-cwd.
  CLI `arggon create bug native-arggon-tools-resolve-tracker-root-to-session-cwd` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native `tools.arggon.*` resolve the tracker root from the process cwd, so a worker editing a worktree silently commits tracker mutations into the primary checkout (session_move does NOT rebind them)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] A tracker write issued from a session working in a worktree lands in that worktree's branch, or is refused with the resolved-vs-expected mismatch named — never silently commits to the primary checkout
- [ ] The resolved tracker root is visible in a read receipt (`show --json` and/or the native equivalent), so an agent can detect the mismatch without guessing
- [ ] `.arggon.env` per-worktree identity (`ARGGON_WORKTREE_PATH` / `ARGGON_STATE_DIR`) is consulted when resolving, so a worktree session cannot bind to the primary
- [ ] A regression test drives the native surface from a worktree cwd and asserts the write lands in the worktree's branch (and one that asserts the refusal/visibility path)
- [ ] `docs/agents.md` §Orchestration (and the worker's operating rules) no longer rely on `session_move` as the mitigation, since it demonstrably does not rebind the tracker root

## Notes
