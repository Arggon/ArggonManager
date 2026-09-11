---
type: bug
status: todo
id: bug-sync-gh-reader
title: "sync gh reader polish: PR list limit, --repo validation, board reader duplication"
parent: story-github
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/bug-sync-gh-reader.md
  Leaves live only under a story. id is the filename stem: bug-sync-gh-reader.
  CLI `arggon create bug sync-gh-reader` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# sync gh reader polish: PR list limit, --repo validation, board reader duplication

## Context

Non-blocking review findings from PR #58 (merge fa18c5e), originally filed as GitHub issue #59 and migrated into `tasks/` (in-tree issue tracking). None affect correctness at current scale; all are worth one small cleanup PR.

## Acceptance

- [ ] `getOpenPRsForRepo` passes `--limit 100` (or paginates) on the `gh pr list` path — today the gh default cap of 30 open PRs can misreport matched items as `unmatched` while the `gh api` fallback fetches 100 and `board` uses `--limit 100`.
- [ ] `--repo` is validated as `owner/name` up front (`cli/src/get-open-prs.ts` splits and non-null-asserts both parts today; `arggon sync --repo foo` currently produces a confusing `foo/undefined` gh error) with an actionable error message.
- [ ] `board.ts`'s inline `gh pr list` wrapper is consolidated onto the shared reader in `get-open-prs.ts` (or `cli/README.md`'s "(board/sync)" wording is corrected) so the gh invocation contract lives in one place.
- [ ] `docs/json-output.md` "whole path segment" phrasing matches the actual `branchReferencesItem` rule (hyphen suffixes like `feat/task-1-work` deliberately match `task-1` for `chore/{id}-{type}` patterns), including the hyphen-prefix-of-another-id edge case.

## Notes

Supersedes GitHub issue #59. Fix should keep `arggon sync --check` exit semantics unchanged.
