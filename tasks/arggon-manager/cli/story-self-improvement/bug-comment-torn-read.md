---
type: bug
status: in_progress
id: bug-comment-torn-read
title: comment initial loadItems can read a torn in-place write
assignee: Arggon
branch: fix/bug-comment-torn-read
parent: story-self-improvement
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T15:14:23.818Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-comment-torn-read
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-comment-torn-read.md
  Leaves live only under a story. id is the filename stem: bug-comment-torn-read.
  CLI `arggon create bug comment-torn-read` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# comment initial loadItems can read a torn in-place write

## Context

`runComment` (cli/src/comment.ts) serializes the item read-modify-write with
`withItemLock`, but the FIRST lookup (`loadItems` -> `itemsById`, ~line 101)
runs BEFORE the lock, and the write is a plain in-place `writeFileSync`
(open+truncate, then write) — not `writeFileAtomic` (cli/src/atomic.ts, already
used for generated docs). A concurrent `arggon comment` process scanning
`tasks/` inside the truncate window reads an empty file; `softTryLoadItem`
treats a file that does not start with `---` as `skip`, so the id is absent and
the process fails with `id '<id>' not found under tasks/` (`COMMENT_FAILED`,
exit 1).

This surfaced as the `comment-race.test.ts` CI flake on run `35353108632`
(attempt 2): `expected 'id 'task-race' not found under task…' to match
/failed to acquire lock/`. The fixture is never deleted: mkdtemp dirs are
unique and the test awaits every spawned CLI child before teardown.

Reproduced locally (2026-09-18):

- 3 torn-read reader children hammering `task-race.md` while 4 real
  `comment --json` CLI children race on it: 65+ observations of the file with
  length 0 (empty) during the truncate->write window.
- With the write window widened (large body) under parallel load, a CLI child
  itself failed with exactly `id 'task-race' not found under tasks/` while the
  torn-read readers kept observing the empty file — the CI failure reproduced.

## Acceptance

- [x] `runComment` writes the item atomically (temp file + rename, e.g. the
      existing `writeFileAtomic`) so a reader can never observe a truncated or
      partial item file.
- [x] The initial lookup runs under `withItemLock` (or retries a transient skip
      of the target file), so a live item cannot look missing to a contender.
- [x] Regression test: a reader racing `comment` never observes the item
      without its frontmatter, and no process reports "not found" while the
      file exists.
- [x] `comment-race.test.ts` can drop its transient "not found" retry branch
      (added by bug-tracker-commit-enotempty-flake) once this is fixed.

## Notes

- Filed from the `bug-tracker-commit-enotempty-flake` investigation. The
  concurrency test now retries this transient failure sequentially (clean,
  reported, zero data loss) so CI is deterministic until the product fix
  lands; the retry is not a substitute for this fix.

### 2026-09-18 @Arggon
Fixed on fix/bug-comment-torn-read — PR #339 (draft, base opencode2).
Deliverable: comment.ts body write now uses writeFileAtomic (tmp+rename) and the locate step retries a transient miss bounded (5 x 20ms) before the authoritative read under withItemLock (returned/committed path comes from the under-lock read). Same-pattern audit: update.ts (main item write, promotion depends_on rewrite, cascade ancestor write) and create.ts switched to writeFileAtomic; handoff.ts delegates to runComment and has no write of its own.
Evidence: deterministic probe (4 concurrent comment CLI children, 1.5MB body, 3 tight-loop readers): 133 torn observations pre-fix (len=0/partial) -> 0 post-fix. Regression test fails pre-fix (79 torn reads with only comment.ts reverted) and passes with the fix. comment-race.test.ts green 12/12 without the PR #338 transient not-found retry. Full suite 69 files / 1144 tests green; build + lint green; arggon validate and spec validate ok. 8 concurrent comments on a 2MB body: 8/8 ok, 0 torn.
Left/reported (no code filed here): adopt --ack and init still write tasks/.convention.yml in place (config, not item files, out of ownership); update.ts promotion/cascade writes are atomic but hold only the initiating item's lock (cross-item lock scope is a separate class).
