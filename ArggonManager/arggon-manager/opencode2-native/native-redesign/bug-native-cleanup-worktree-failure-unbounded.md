---
type: bug
status: in_progress
id: bug-native-cleanup-worktree-failure-unbounded
title: Native cleanup worktree-removal failure message is unbounded while the branch-delete path is capped at 500 chars
assignee: Arggon
branch: fix/bug-native-cleanup-worktree-failure-unbounded
parent: native-redesign
labels: [opencode-seam, worktree, review-followup]
priority: p2
created: "2026-09-28"
updated: "2026-09-29"
claimed_at: "2026-09-29T00:17:03.674Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-native-cleanup-worktree-failure-unbounded
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-native-cleanup-worktree-failure-unbounded.md
  Leaves live only under a story. id is the filename stem: bug-native-cleanup-worktree-failure-unbounded.
  CLI `arggon create bug native-cleanup-worktree-failure-unbounded` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native cleanup worktree-removal failure message is unbounded while the branch-delete path is capped at 500 chars

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-28 @Arggon-coordinator
## Context

Found by the coordinator while reviewing PR #428
(`bug-native-cleanup-branch-delete-missing-failure`, merged). That fix bounded the **branch-delete**
failure message; the **worktree-removal** failure in the same envelope is still unbounded, so one
`cleanup` payload can mix a 500-char message and an arbitrarily long one.

Evidence, from the current `opencode/plugins/arggon/index.ts`:

- Branch-delete catch (line ~3440, **fixed** by PR #428):
  `const message = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)` → pushed to
  `failures` and reused for `pruned`. Bounded.
- Outer per-candidate catch (line ~3489, **unchanged**):
  `const message = detail(error)` → pushed to `failures` and `pruned`. **Unbounded**, and
  `detail()` is just `error instanceof Error ? error.message : String(error)` (line 938) with no
  clip.

So a failing `git worktree remove` whose stderr is long (a git error can carry several hundred
chars, and a domain rejection can carry an entire message) flows unbounded into a native tool
payload, twice — once in `pruned[].error` and once in `failures[]`. ADR 0006's spirit is that
envelopes stay bounded, and the review bar names bounded payloads as a review dimension. The
inconsistency is also the kind that quietly grows: the next reader will assume the cleanup envelope
is uniformly bounded because one of its two failure surfaces is.

Note: the evidence in PR #428's item body states the branch-delete fix reuses "the same helper +
500-char cap as the worktree-removal failure". That is not accurate — the worktree-removal path never
used the helper. Correcting the record here so the next reader is not sent looking for bounding that
is not there.

## Acceptance

- [ ] The outer per-candidate failure message is bounded with `boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)`, so both failure surfaces of a `cleanup` envelope carry the same bounded text for every failure kind.
- [ ] Add a deterministic test that a worktree-removal failure with an over-cap message yields the capped text in BOTH `pruned[].error` and `failures[]`.
- [ ] Assert the flat entry's total length is bounded too (`<id>` + separator + capped message), not just the message.
- [ ] Confirm no consumer depends on the full unbounded text (the native TUI/board renderers and the CLI parity path), and say what you checked.
- [ ] Check the CLI twin (`cli/src/cleanup.ts`, tracked as `bug-cli-cleanup-branch-delete-missing-failure`) for the same unbounded outer message; if it is unbounded too, note it there rather than fixing it in this PR.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run lint:structure`, `npm run test:structure` and `arggon validate` are green.

## Notes

Found 2026-09-28 during the PR #428 review. Not a merge blocker for that PR — its scope is the
branch-delete surface and it did that correctly; this is the sibling surface that PR's bounding made
visible.
