---
type: task
status: done
id: task-spawned-tests-gh-path
title: "Spawned-CLI tests fail with a misleading 'could not resolve comment author' when gh is off PATH"
assignee: Arggon
branch: feat/task-spawned-tests-gh-path
parent: tooling-and-environment
labels: [tooling, testing]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
worktree_path: /home/arggon/Projects/ArggonManager-task-spawned-tests-gh-path
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-spawned-tests-gh-path.md
  Leaves live only under a story. id is the filename stem: task-spawned-tests-gh-path.
  CLI `arggon create task spawned-tests-gh-path` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spawned-CLI tests fail with a misleading 'could not resolve comment author' when gh is off PATH

## Context

The spawned-CLI failures traced to three sites sharing one root cause: comment-author resolution
(`resolveCurrentLogin`: GITHUB_USER → GITHUB_ACTOR → `gh api user`) failed with gh off PATH, and the
generic "could not resolve comment author" error named the wrong missing dependency.

1. `cli/src/measure.ts` `measureBudget` spawned `arggon comment …` as FIXTURE SETUP with no explicit
   author — 8 measure tests failed on host identity, not on what they assert.
2. `runComment` resolved the author BEFORE locating the item, so `arggon_comment {id:"nope"}` in the
   MCP test surfaced the author error instead of the deterministic `id 'nope' not found`.
3. `opencode/plugins/arggon/tools.test.ts` "keeps the plugin location…" commented without an author.

## Acceptance

- [x] Comment-author resolution degrades gracefully without gh: documented fallback to the local git
  identity (`git config user.name`) appended to the chain in `resolveCurrentLoginDetailed`
  (`lib/src/list.ts`); the affected tests are additionally hermetic (explicit `--author` / author
  input), so none depends on host gh or git identity.
- [x] Error message for the missing dependency names 'gh' (not 'comment author'):
  `could not resolve comment author: 'gh' not found on PATH …` (gap `gh-not-found`) vs
  `… gh is not authenticated ('gh api user' failed) …` (gap `gh-failed`); item-id errors now precede
  author errors deterministically.
- [x] Full suite green in an environment without gh on PATH (recipe in the 2026-10-01 @Arggon note).

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the bug-frontmatter-ambiguous-plain-scalar-loss worker's environment report (PR #509).

## Context
With the mise gh shim off PATH, 10 spawned-CLI tests fail (measure x8, comment x1, plugin tools x1) with "could not resolve comment author" — the error names the wrong missing dependency. Environmental (CI has gh; local dev may not), but the diagnosis cost the worker time.

## Acceptance
- [x] Comment-author resolution either degrades gracefully without gh (documented fallback) or the failing tests assert an actionable precondition (skip with reason naming 'gh not found on PATH'). (2026-10-01, PR #558: documented fallback chain GITHUB_USER -> GITHUB_ACTOR -> gh -> git config user.name, in lib/src/list.ts resolveCurrentLoginDetailed.)
- [x] Error message for the missing dependency names 'gh' (not 'comment author'). (PR #558: lib/src/comment.ts distinguishes absent vs unauthenticated gh; item lookup now precedes author resolution so caller errors are never masked.)
- [x] Full suite green in an environment without gh on PATH (or every affected test skips with the actionable reason). (2026-10-01, PR #558: no-gh simulation 2043/2043 exit 0, 4 consecutive runs; recipe documented in the worker note.)

### 2026-10-01 @Arggon
Resolution + gates evidence (PR #558).

**Approach: graceful degradation (documented fallback) + gh-naming errors + hermetic affected tests.** No skips.

- `lib/src/list.ts`: `resolveCurrentLoginDetailed` — chain is now GITHUB_USER → GITHUB_ACTOR → gh api user → **git config user.name** (documented last-resort local identity); gh/g probes honor the passed env so tests scope PATH hermetically. `resolveCurrentLogin` signature unchanged; @me consumers (list/board/start/tui) benefit without changes.
- `lib/src/comment.ts`: item locate now precedes author resolution (bad-id errors are deterministic, no longer masked by the environmental author gap); failure message names the actual dependency — `could not resolve comment author: 'gh' not found on PATH …` vs `… gh is not authenticated ('gh api user' failed) …`.
- `cli/src/measure.ts`: fixture comment passes `--author fixture` (fixture data must not depend on host identity) — fixes all 8 measure failures at the root.
- `opencode/plugins/arggon/tools.test.ts`: ambient-location test passes an explicit author.
- Tests: +5 resolver-chain unit tests (fake-bin PATH scoping: gh-found / gh-missing→git fallback / gh-unauthenticated / nothing-available), +3 comment-level pins (gap message, git fallback end-to-end, id-before-author precedence).

**Reproduction (before):** `env -i PATH="/usr/bin:/bin" HOME=$HOME vitest run cli/src/measure.test.ts cli/src/comment.test.ts opencode/plugins/arggon/tools.test.ts` → measure ×8 + comment ×1 + plugin ×1 failed, exactly the reported inventory.

**Gates:** build ✅ · check:plugin ✅ (bundle rebuilt, 52+/13- lines) · lint ✅ · `arggon validate` ok:true ✅ · full suite 2043/2043 (normal PATH) ✅.

**No-gh recipe:** `env -i PATH="$HOME/.local/share/mise/installs/node/26.7.0/bin:/usr/bin:/bin" HOME=$HOME LANG=C.UTF-8 node_modules/.bin/vitest run` (mise node real bin dir keeps node/npm; gh lives only in mise shims/~/.local/bin — all excluded) → 2043/2043, exit 0, 4 consecutive runs. One earlier no-gh run under a loaded machine (157s vs ~76s) had a single unreproduced failure; runs 2–5 all clean — likely the repo's documented spawn-timeout-under-load flake class, not this diff (all touched files passed repeatedly under no-gh).

### handoff 2026-10-01 @Arggon (session: ses_f0735ed79ffemPirGuKKl8PhYs) — next: Review PR #558 (do not merge from this session); squash-merge after approval
- branch: feat/task-spawned-tests-gh-path
- open questions: Run-1 no-gh flake unreproduced (runs 2-5 clean); git-config fallback may surprise @me filters only when gh absent AND git identity equals an assignee login
