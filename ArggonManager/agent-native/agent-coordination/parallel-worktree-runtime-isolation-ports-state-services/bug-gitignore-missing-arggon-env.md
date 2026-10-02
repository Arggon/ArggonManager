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

### 2026-10-02 @ses_f01ff0880ffeUkY0YiMsq3V3QC
## Evidence (2026-10-02, fix/bug-gitignore-missing-arggon-env)

Fix: repo-root `.gitignore` gains `.arggon.env` with a comment naming spec worktree-env-contract-016 (commit on fix/bug-gitignore-missing-arggon-env).

Fresh `start --worktree` receipt (scratch item task-scratch-verify-env-gitignored-receipt, now cancelled), run from the fix branch so the worktree base carried the gitignore entry:

```json
"env":{"written":true,"path":".../ArggonManager-bug-gitignore-missing-arggon-env-task-scratch-verify-env-gitignored-receipt/.arggon.env","keys":["ARGON_ITEM","ARGGON_WORKTREE_ID","ARGGON_WORKTREE_PATH","ARGGON_WORKTREE_BRANCH","ARGGON_STATE_DIR","ARGGON_CACHE_DIR"],"gitignored":true}
```

```$ git status --porcelain   # in the fresh worktree
exit=0   # (empty output — clean)
$ git check-ignore -v .arggon.env
.gitignore:48:.arggon.env	.arggon.env
```

Decision (acceptance #3): `init`/`adopt` must never silently rewrite an adopter's `.gitignore`; a documented hand-step alone already proved insufficient for this repo, so the new item task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters files a report-only `init`/`adopt`/`doctor` hint (stdout + --json note) when `.arggon.env` is missing from the tracked `.gitignore`, never a write.
