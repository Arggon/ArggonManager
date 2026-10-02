---
type: bug
status: todo
id: bug-gitignore-missing-arggon-env
title: "`.gitignore` does not ignore `.arggon.env`, so the 0.5.0 worktree env contract drops an untracked file into every worktree"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, hygiene]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-gitignore-missing-arggon-env.md
  Leaves live only under a story. id is the filename stem: bug-gitignore-missing-arggon-env.
  CLI `arggon create bug gitignore-missing-arggon-env` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `.gitignore` does not ignore `.arggon.env`, so the 0.5.0 worktree env contract drops an untracked file into every worktree

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @ses_f03213cdbffeJ4RqV9JXfur867
Found by a 0.5.0 adoption audit (2026-10-02, coordinator session).

## Context

v0.5.0 #566 makes every `start --worktree` write a gitignored `.arggon.env` at the worktree root,
and `arggon init` adds `.arggon.env` to the `.gitignore` it **generates** — fresh scaffolds only.
This repo adopted the tracker before that template shipped, and `init`/`adopt` never rewrite an
adopter-modified file, so `.gitignore` on `origin/main` has never gained the entry
(`git show origin/main:.gitignore | grep arggon.env` → nothing).

Nothing has been written yet only because the vendored plugin copy still predates the feature
(bug-generated-seam-bytes-predate-050). As soon as that seam is refreshed, every parallel worktree
this coordinator spawns (19 exist right now) starts with one untracked `.arggon.env`.

Consequences, in the class of bug-harness-config-churn (the `.zcode/` fix): per-worktree
`git status` churn that workers and the reviewer see on every read, and an untracked file that
reads as an unexplained modification during review. `cleanup --prune` already reaps a start-created
env file of the exact contract shape, so removal is not the risk — visibility noise is.

## Acceptance

- [x] `.arggon.env` ignored in the repo-root `.gitignore`, with a comment naming the contract
      (spec worktree-env-contract-016) so the next reader does not remove it as dead weight.
- [x] A fresh `start --worktree` in this repo reports `env.gitignored: true` in the `env` receipt,
      and `git status --porcelain` in the worktree is clean afterwards.
- [x] Decided and recorded: should `init`/`adopt` *offer* to add the entry to an adopter's existing
      `.gitignore` (report-only, never a silent rewrite), or is a documented hand-step enough? Any
      follow-up item is filed here.
- [x] Evidence: the receipt line and the clean status pasted on the item.
