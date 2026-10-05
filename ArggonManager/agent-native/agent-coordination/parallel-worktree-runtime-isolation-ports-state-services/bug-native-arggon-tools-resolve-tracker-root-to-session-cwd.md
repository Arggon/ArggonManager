---
type: bug
status: todo
id: bug-native-arggon-tools-resolve-tracker-root-to-session-cwd
title: "Native `tools.arggon.*` resolve the tracker root from the process cwd, so a worker editing a worktree silently commits tracker mutations into the primary checkout (session_move does NOT rebind them)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, worktree, hygiene]
created: "2026-10-02"
updated: "2026-10-02"
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

### 2026-10-05 @arggon-delivery-lead
### 2026-10-05 @arggon-delivery-lead
**In flight — do not dispatch.** Work is complete and reviewed on branch `fix/bug-native-arggon-tools-resolve-tracker-root-to-session-cwd`, open as **PR #646**. The claim (`in_progress` / assignee / `worktree_path`) lives on that **branch**, not on `main`, so this item still reads as unclaimed `todo` here — the merge carries the frontmatter across.

Recorded so no wave re-claims it and opens a conflicting branch: a previous session produced 7 PRs that were invisible to the tracker for exactly this reason, and the fix for it (PR #646) is itself subject to it until it merges.

Merge is currently held by a **pre-existing** gate flake, not by this change: `cli` failed with the harness's own `kernel artifact drift … another suite lane rebuilt lib/dist in place` verdict plus `SyntaxError: './json.js' does not provide an export named 'compactWorkItem'` — `bug-test-suite-lib-dist-rebuild-race` (p1), the same defect red-lining PRs #618 and #586. CI was green on this branch's earlier head (runs 3736254693 / 3736254688). Full delivery-lead verdict and gate evidence are on the branch.
