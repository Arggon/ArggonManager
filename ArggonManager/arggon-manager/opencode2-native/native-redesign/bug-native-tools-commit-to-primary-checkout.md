---
type: bug
status: todo
id: bug-native-tools-commit-to-primary-checkout
title: Native arggon tools resolve the tracker from the primary checkout and commit to it while the session works in a worktree
parent: native-redesign
labels: [opencode-seam, worktree, dogfood]
priority: p1
created: "2026-09-28"
updated: "2026-09-28"
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

### 2026-09-28 @Arggon-coordinator
## FINAL APPROVE — PR #426 (`72026ada`), P1

I re-derived the root cause from the diff rather than accepting the summary, verified the bundle and
the branch's blast radius myself, and checked the behaviour change against the JSON contract.
**Merge authorized; this comment performs no merge and no `done` flip.**

### Root cause: confirmed, and the diagnosis is the interesting part
`setup()` resolved the tracker directory **once** and froze it for the plugin instance's lifetime, so
all 15 tool specs passed a stale `options.cwd` to the kernel and `findTasksDir()` walked up from the
checkout the plugin was **loaded** in. The decisive supporting evidence is not a code reading but a
**live A/B inside the fixing session**: native `show` returned the primary's state
(`todo`/`null`) for the very item whose worktree the session was sitting in, while the CLI
`show` in the same cwd returned `in_progress`/`Arggon`/`fix/…`/`worktree_path`. And the
structural confirmation that `sessionID` is the only per-call signal available — the V2 plugin tool
context is `{ sessionID, agent, messageID, id, progress, signal }`, no directory. I checked that
claim against the diff: the fix reads the session id from the existing `ArgonToolCallContext`
rather than inventing a channel, and the doc comment records the runtime shape.

### Architecture and boundaries
- The fix sits at the **single shared seam** — the `execute` dispatch that wraps every spec — not
  per-tool. Acceptance box 1 asks for *every* `tools.arggon.*` call, and this delivers all 15 by
  construction rather than the 5 that were tested. That is the right place: the old bug was one
  captured value in one place, so one place is where it is fixed.
- **The refusal is the part I care about most.** A session that is *known* but whose directory cannot
  be resolved raises a typed `SESSION_ROOT_UNRESOLVED` `ArgonToolError` and writes nothing — it does
  **not** fall back to the plugin location. Falling back would reproduce the original defect with a
  lookup failure as the trigger, and a silent `ok: true` on the wrong branch is strictly worse than a
  refused call. The plugin-location fallback now applies only when there is genuinely no calling
  session, or when the host has no `ctx.session.get` at all (feature-detected, degrades to
  pre-fix behavior rather than breaking).
- The three rejected candidates are argued, not asserted: `ctx.location.directory` (the defect, with
  the V2 quote that it is the *plugin instance's* location), `process.cwd()` (the host's launch
  directory, and a background `opencode serve` carries its own), and the item's `worktree_path`
  (chicken-and-egg — reading it needs the root being resolved). `start` keeps its shape: the session's
  root, with the worktree still placed next to `ctx.location.project.canonical`. No `lib/src`
  change, CLI rule untouched, one walk-up (ADR 0011).

### Contract accuracy — the one thing I checked hardest
A new error code is a schema surface, and the bar is no silent forks. `SESSION_ROOT_UNRESOLVED` is
**native-only** (the CLI resolves the same root from its own cwd and can never reach it), and the
worker documented it in `opencode2.md` rather than the CLI code table, with the reason stated. That
is the correct placement, and saying why in the doc is what keeps the next reader from "fixing" it
into the wrong table. `convention.md` and `json-output.md` are correctly untouched.

### Tests travel with behavior, and they are falsifiable
7 behavioural tests over a real primary plus a real `git worktree add -b`, with the definitions
deliberately bound to the **primary** so every assertion is about the per-call resolution and not the
fallback; 3 pure `resolveToolCwd` tests; 4 wiring tests. The negative control is the part I value:
with the per-call resolution removed, **5 of 7 fail**, including both refusal cases flipping to
`ok: true` into the primary. The 2 that still pass are the two pinning deliberately unchanged
behavior — a session in a plain checkout, and a call with no session — so the count is explained
rather than merely reported.

I also verified the **blast radius**: the branch touches only its own item, `opencode2.md` and the
four plugin files. No cross-item edits, and the primary is clean. `npm run check:plugin` regenerates
byte-identically (372 300 B, 3 occurrences of the new code) and `git diff --exit-code` passes.

### The worker's own workflow is the live proof
Its `comment`/`handoff` calls went through the **CLI** from inside the worktree and produced
`8eba33e3`/`e9988ece`/`6d8bfe2d` on `fix/bug-native-tools-commit-to-primary-checkout` — contained by
that branch and absent from `main`. That is precisely the behavior that was impossible in the same
session hours earlier (`d24215b9` landing on the primary's `main`), and it is stronger evidence than
any fixture: the same code path, in the same session, before and after.

### Gates
`npm test` 97 files / 1660 · `lint` · `build` · `check:plugin` · `lint:structure` (ast-grep clean,
run for real — the local install gap is fixed) · `test:structure` 3/3 · `arggon validate` `ok:true`.
CI `36496008205` (`cli`, `ui-smoke`) and `36496008265` (`tasks-validate`) both success on this head.

### Residual limitation, and it is now tracked
The suite models the V2 tool context; the single unproven link is the real host answering
`ctx.session.get` with a *moved* session's `location.directory`. Contained (worst case is the loud
refusal), but contained is not proven. Filed as `task-native-session-move-smoke-leg` (p3) rather than
left as a handoff note.

Second, unrelated to this change but worth the record: `opencode.jsonc`'s `"formatter": true` rewrote
~900 lines of the `.prettierignore`d, semicolon-free plugin source when the worker used `edit`/`write`
there — bypassing the decision `task-plugin-source-prettier-policy` made. The worker reverted it and
worked around it; filed as `task-session-formatter-bypasses-prettierignore` (p3).
