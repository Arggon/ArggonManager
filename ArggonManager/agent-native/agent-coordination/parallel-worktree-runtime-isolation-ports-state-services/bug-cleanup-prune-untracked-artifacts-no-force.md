---
type: bug
status: todo
id: bug-cleanup-prune-untracked-artifacts-no-force
title: "cleanup --prune classifies a done+merged worktree removable and then fails on untracked generated artifacts, with no force path — every wave ends in manual git worktree remove --force"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, hygiene, friction]
created: "2026-10-12"
updated: "2026-10-12"
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-cleanup-prune-untracked-artifacts-no-force.md
  Leaves live only under a story. id is the filename stem: bug-cleanup-prune-untracked-artifacts-no-force.
  CLI `arggon create bug cleanup-prune-untracked-artifacts-no-force` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --prune classifies a done+merged worktree removable and then fails on untracked generated artifacts, with no force path — every wave ends in manual git worktree remove --force

## Context

Observed by the delivery lead at the end of the release-pipeline waves,
2026-10-12. `tools.arggon.cleanup({ prune: true })` on four done+merged
worktrees:

- classified all four `removable: true` ("remove worktree and delete the merged
  branch"), then failed the actual removal with git's own refusal:
  `contains modified or untracked files, use --force to delete it`;
- each worktree's only "content" was untracked generated scaffolding:
  `.opencode/harness/`, `.opencode/checks/`, `.opencode/specs/` (agent-harness
  and local-tooling artifacts, never committed, never in a PR);
- the tool exposes no `--force`, so the wave ended in a manual loop
  (`git worktree remove --force <path>` + `git branch -D` per branch) and a
  second prune run just to clear the `worktree_path` records.

The conservative refusal is right for unknown files; the gap is that a
done+merged worktree's untracked **generated** paths have no handling, and the
classify/act mismatch (`removable: true` → raw failure) reads as a bug to the
operator. Note the artifacts' origin is partly outside ArggonManager (a local
agent-harness plugin writes `.opencode/harness/`), so the fix should not assume
it can prevent them.

## Acceptance

- [ ] Decide and implement one: (a) `cleanup` reaps a declared set of generated
      paths (e.g. the worktree env contract's own artifacts plus a configurable
      ignore list) before removal; (b) an explicit `--force` / `takeOver`
      equivalent for prune on terminal+merged items; or (c) a recorded decision
      that manual force-removal is the intended remedy — with the reasoning
      (the current receipt does name the command, but not the branch deletion or
      the record-clearing second run)
- [ ] Classification is honest: if the tool will not remove it, it must not
      print `removable: true` with a null reason — or the failure must name the
      full manual sequence (remove --force, branch -D, re-run prune)
- [ ] A test covers the chosen path (a worktree with an untracked artifact file
      / dir), and `cleanup --prune` stays conservative for unknown untracked
      files (never silently discards uncommitted work)
- [ ] If generated paths are hard-coded, they come from the same declarations
      the rest of the system uses (the worktree env/state contract), not a new
      ad-hoc list

## Notes
