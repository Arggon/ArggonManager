---
type: bug
status: in_progress
id: bug-native-tools-commit-to-primary-checkout
title: Native arggon tools resolve the tracker from the primary checkout and commit to it while the session works in a worktree
assignee: Arggon
branch: fix/bug-native-tools-commit-to-primary-checkout
parent: native-redesign
labels: [opencode-seam, worktree, dogfood]
priority: p1
created: "2026-09-28"
updated: "2026-09-28"
claimed_at: "2026-09-28T22:45:55.079Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-native-tools-commit-to-primary-checkout
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-native-tools-commit-to-primary-checkout.md
  Leaves live only under a story. id is the filename stem: bug-native-tools-commit-to-primary-checkout.
  CLI `arggon create bug native-tools-commit-to-primary-checkout` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native arggon tools resolve the tracker from the primary checkout and commit to it while the session works in a worktree

## Context

The repo mandates one branch per item and "always work in a git worktree" (`AGENTS.md`,
`ArggonManager/docs/agents.md` §2). `tools.arggon.start` honors that: it creates
`../<repo>-<id>` through the OpenCode worktree domain. But the **other** native tools do not
appear to. `tools.arggon.comment`, `tools.arggon.handoff` and `tools.arggon.update` resolve the
tracker root from something other than the session's worktree — in practice the primary
checkout — and commit there, on whatever branch the primary has checked out.

Observed twice in one coordinator session on 2026-09-28, from workers working entirely inside
their item worktrees:

1. The PR #422 worker (`bug-opencode-smoke-normalize-bracket-namespace`) called
   `tools.arggon.comment`/`handoff` from
   `/home/arggon/Projects/ArggonManager-bug-opencode-smoke-normalize-bracket-namespace`. The
   commits landed on the **primary's** `main`: `b65ef7c6` (comment) and `adacc20a` (handoff),
   both reachable from `main` today.
2. The PR #423 worker (`task-pilot-opencode2-shell-tasks-server-only`) called
   `tools.arggon.handoff` from its worktree and got commit `d24215b9` on the primary's
   `main`. It detected the mistake, ran `reset --hard` back to `44c5f3d9` and redid the handoff
   through the CLI inside the worktree. `git cat-file -t d24215b9` confirms the commit exists;
   it is unreferenced, which is the only reason the primary's history is intact.

Why this matters beyond tidiness: the commit is written to `main`, not to the item branch, so
the worker's evidence is **not** in the PR it opens, and the return envelope reports
`ok: true` with a commit hash that a reviewer of that PR will never see. Pushed from a
worktree session, it also lands tracker state on `main` that no reviewed PR carries. This is
the native-seam counterpart of the tracker-root resolution the CLI already does by walking up
from `process.cwd()`.

## Acceptance

- [ ] Every native `tools.arggon.*` call resolves the tracker root from the **session's** working directory (the worktree the session moved into), exactly like the CLI; verify `comment`, `handoff`, `update`, `create` and `branch`.
- [ ] A commit produced from a worktree session lands on the **item's branch inside that worktree**, and its hash is reachable from the item's PR head.
- [ ] The tool never writes tracker files or commits to the primary checkout while the session cwd is a worktree, even when the worktree is not the repository's `main` worktree.
- [ ] Document the resolution rule in `ArggonManager/docs/opencode2.md` next to the worktree/start contract, and state what a session running from a non-worktree checkout does.
- [ ] Add a deterministic regression test that runs a committing native tool from a disposable worktree and asserts the commit's branch and worktree path.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run lint:structure`, `npm run test:structure` and `arggon validate` are green.

## Notes

Found 2026-09-28 during the coordinator review of PRs #422 and #423. Not caused by either PR:
the native tracker tools and the worktree lifecycle were never covered by a test that runs a
committing tool from inside a worktree. Related but distinct: `bug-stale-vendored-plugin-copy`
(vendored copy under `init` re-runs).
