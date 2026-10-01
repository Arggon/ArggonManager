---
type: task
status: in_progress
id: task-spawned-tests-gh-path
title: "Spawned-CLI tests fail with a misleading 'could not resolve comment author' when gh is off PATH"
assignee: Arggon
branch: feat/task-spawned-tests-gh-path
parent: tooling-and-environment
labels: [tooling, testing]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T18:46:42.543Z"
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
- [ ] Comment-author resolution either degrades gracefully without gh (documented fallback) or the failing tests assert an actionable precondition (skip with reason naming 'gh not found on PATH').
- [ ] Error message for the missing dependency names 'gh' (not 'comment author').
- [ ] Full suite green in an environment without gh on PATH (or every affected test skips with the actionable reason).
