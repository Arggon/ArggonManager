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

### 2026-09-28 @Arggon
Root cause established with evidence, before any fix was written.

**It was a captured/stale root, not an explicit primary-checkout path.** `opencode/plugins/arggon/index.ts` resolves the tracker directory once, in `definition.setup()`:

    const directory = locationDirectory(ctx)          // === ctx.location.directory
    await registerArgonTools(ctx, { cwd: directory, … })

`ArgonToolOptions.cwd` is then frozen for the plugin instance's lifetime, and all 15 tool specs pass that value straight to the kernel (`cwd: options.cwd`), so `findTasksDir()` walks up from the checkout the plugin was LOADED in. OpenCode V2's own docs (`/build/plugins`, Context) call `ctx.location` "the plugin instance's location, **not** the location of every session it can access or event it receives" — so after `opencode.session_move` the captured value is stale by construction. There is no separate primary-checkout lookup anywhere in the plugin; `canonicalRoot()`/`options.worktree.canonical` is used only for `start`'s worktree placement and never as a tracker root.

**Live reproduction, read-only, in the very session that owns this fix** (this worktree is `/home/arggon/Projects/ArggonManager-bug-native-tools-commit-to-primary-checkout`):

| source | resolved tracker root | status | assignee | branch | worktree_path |
| --- | --- | --- | --- | --- | --- |
| `tools.arggon.show({ id, meta: true })` (native, session cwd = this worktree) | `/home/arggon/Projects/ArggonManager` (primary, on `main`) | `todo` | `null` | `null` | `null` |
| `npm run arggon -- show bug-native-tools-commit-to-primary-checkout --meta --json` (same worktree) | this worktree | `in_progress` | `Arggon` | `fix/bug-native-tools-commit-to-primary-checkout` | `/home/…/ArggonManager-bug-…` |

The native read already answers from the primary's `main` while the worker's cwd is the worktree; a committing tool from the same session therefore commits to `main` — which is exactly how `b65ef7c6`/`adacc20a` reached `main` and how `d24215b9` was produced.

**Why the session's own directory is the right resolution rule.** The V2 tool context is built as `{ sessionID, agent, messageID, id, progress, signal }` — V2 hands a plugin tool **no directory**, so `sessionID` is the only per-call signal of where the session works, and `ctx.session.get({ sessionID })` → `Session.Info.location.directory` is what `session.move` updates. The candidates rejected: (a) `ctx.location.directory` — the plugin instance's location, stale after a move (the defect); (b) `process.cwd()` — the host process's launch directory, and a background `opencode serve` carries its own, never the session's; (c) the item's recorded `worktree_path` — chicken-and-egg, reading it needs the root being resolved (it stays authoritative for what `start` attaches to, not for where a call resolves). A session's directory is the one rule that matches one-branch-per-item: the branch the session moved onto is the branch its commit must land on, so the evidence is in the PR.

**The failure is loud, not silent.** Once a session is known, an unresolvable directory raises a typed tool error (`error.code: SESSION_ROOT_UNRESOLVED`, an `ArgonToolError` with the envelope) rather than falling back to the plugin location — committing to the wrong checkout because a lookup failed is the failure being fixed. The plugin-location fallback applies only when there is no calling session at all, and when the host has no `ctx.session.get` (degrades to the pre-fix behavior instead of breaking).
