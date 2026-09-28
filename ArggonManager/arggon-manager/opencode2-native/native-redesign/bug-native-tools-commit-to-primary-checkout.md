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

- [x] Every native `tools.arggon.*` call resolves the tracker root from the **session's** working directory (the worktree the session moved into), exactly like the CLI; verify `comment`, `handoff`, `update`, `create` and `branch`.
- [x] A commit produced from a worktree session lands on the **item's branch inside that worktree**, and its hash is reachable from the item's PR head.
- [x] The tool never writes tracker files or commits to the primary checkout while the session cwd is a worktree, even when the worktree is not the repository's `main` worktree.
- [x] Document the resolution rule in `ArggonManager/docs/opencode2.md` next to the worktree/start contract, and state what a session running from a non-worktree checkout does.
- [x] Add a deterministic regression test that runs a committing native tool from a disposable worktree and asserts the commit's branch and worktree path.
- [x] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run lint:structure`, `npm run test:structure` and `arggon validate` are green.

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

### 2026-09-28 @Arggon
Acceptance evidence — expected vs observed, per box. Fix: `opencode/plugins/arggon/index.ts` only (+ regenerated bundle, tests, docs). No `lib/src` change: the kernel's `findTasksDir()` already walks up from the `cwd` it is handed (CLI parity), so the defect was entirely on the native side.

**Box 1 — every native call resolves the tracker root from the session's directory; verify comment, handoff, update, create, branch.**
Expected: all five read + commit the WORKTREE copy. Observed: `branch` → `update` → `comment` → `handoff` → `create` all report `ok: true` with a commit; after each, `git -C worktree branch --show-current` = `fix/task-rate-limit`, the worktree HEAD is the reported hash, and the primary's item bytes are unchanged. A read is asserted too: `show` from the session returns `{status: in_progress, assignee: smoke, branch: fix/task-rate-limit}` while the primary copy is still `todo` with no `branch`. The created item exists in the worktree and not in the primary. Test: `tools.test.ts` → `"resolves the tracker root from the session's worktree for comment, handoff, update, create and branch"`.

**Box 2 — the commit lands on the item's branch inside that worktree and its hash is reachable from the item's PR head.**
Expected: commit on `fix/<id>` in the worktree, present at the pushed item-branch tip. Observed: `git -C worktree branch --contains <hash> --format=%(refname:short)` → `fix/task-rate-limit`; `git -C worktree rev-parse <hash>^{commit}` == worktree HEAD; the branch is pushed to a local bare `origin` and `git -C origin.git rev-parse fix/task-rate-limit` carries the hash. Independently, in this very session, the CLI `comment` above committed `8eba33e3` on `fix/bug-native-tools-commit-to-primary-checkout` inside this worktree, `git branch --contains 8eba33e3` lists only that branch, and the primary is still on `main` at `3d40159d` with an item file containing none of this evidence.

**Box 3 — never writes tracker files or commits to the primary while the session cwd is a worktree, even for a non-base-branch worktree.**
Expected: primary HEAD unchanged, `git status --porcelain` empty, primary item bytes identical, base branch still one commit. Observed: all four hold after `update` + `comment`; the worktree under test is a real LINKED (non-main) worktree created with `git worktree add -b`. Two refusal cases pin the loud path: an unresolvable session directory and a *throwing* session lookup both reject with `ArgonToolError` `code: SESSION_ROOT_UNRESOLVED` and leave the primary with an empty `git status --porcelain` and an unchanged item file. Negative control: with the per-call resolution temporarily removed, 5 of the 7 behavioural tests fail — the 5-tool test on `branch: the reported hash is the worktree HEAD`, the primary-hygiene test on its base-branch commit count, and both refusal tests because the call resolved `ok: true` into the primary instead of rejecting. The 2 tests that still pass there are the two that pin deliberately unchanged behaviour (a session in a plain checkout; a call with no session).

**Box 4 — the rule is documented in `ArggonManager/docs/opencode2.md` next to the worktree/start contract, including the non-worktree case.**
Observed: new section `### Where every native tool resolves the tracker root`, placed between the worktree-lifecycle contract and the permissions bullet. It states the rule, a 4-row table (worktree session / non-worktree checkout / no calling session / unresolvable), why the three rejected candidates are wrong (with the V2 quote), why the failure is loud, that `start` still places the worktree next to the canonical checkout, and the test names that carry the evidence. Compatibility: the CLI rule is unchanged and still the single walk-up (`convention.md` §Detection, `json-output.md` untouched); `SESSION_ROOT_UNRESOLVED` is native-surface-only and documented here rather than in the CLI's code table, because the CLI resolves the same root from its own cwd and can never reach it.

**Box 5 — a deterministic regression test that runs a committing native tool from a disposable worktree and asserts the commit's branch and worktree path.**
Observed: `opencode/plugins/arggon/tools.test.ts` → `describe("tracker-root resolution from the calling session")`, 7 tests over a `seedGitTree()` primary + real `git worktree add -b` worktree, with the definitions bound to the PRIMARY location on purpose (so the assertions are about per-call resolution, not the fallback). Each asserts the branch, that the reported hash is the worktree HEAD and resolves there, and that the primary is byte-identical. Plus `describe("resolveToolCwd: per-call tracker root")` (3 pure tests: preference, both fallbacks, typed failure with envelope) and `index.test.ts` → `describe("plugin-context: session directory wiring")` (4 tests: `location.directory`, bare `directory`, non-string rejected, feature detection, id pass-through, throw propagation). All temporary; teardown removes the `mkdtemp` parent with the worktree inside it.

**Box 6 — gates green (all re-run after the final edit, from this worktree).**
`npm test` → **97 files / 1660 tests passed**; `npm run lint` → clean; `npm run build` → tsc + lib build + `build:plugin` clean; `npm run check:plugin` → bundle regenerated and committed (the only diff is the two new source constructs inlined); `npm run lint:structure` → ast-grep scan clean; `npm run test:structure` → 3/3 PASS (`native-tools-use-shared-seam`, `tracker-mutations-use-kernel`, `tracker-rename-destination-use-kernel`); `npm run arggon -- validate --json` → `{"ok":true,…,"errors":[],"warnings":[]}`.

Not verified, honestly: the **real-runtime leg** (`npm run smoke:opencode`) was not run — `smoke/**` is owned by another worker in this wave, it is model-driven and timing-sensitive, and it must not run alongside a loaded machine. The in-process suite models the V2 tool context exactly (the runtime builds it as `{sessionID, agent, messageID, id, progress, signal}` — read out of the pinned 2.0.18 binary), so the only untested link is the host actually answering `ctx.session.get` with the moved session's `location.directory`.

### handoff 2026-09-28 @Arggon — next: Review the diff, merge, then let the coordinator flip status: done. Next concrete step after merge: add a smoke:opencode leg that moves a session into the worktree and asserts the commit's branch (sm…
- branch: fix/bug-native-tools-commit-to-primary-checkout
- open questions: Does ctx.session.get answer correctly for a session that moved to another location, from a plugin instance bound to the old location? Untested against a real runtime; in-process tests model the V2 to…
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
