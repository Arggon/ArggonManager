---
type: bug
status: todo
id: bug-native-cleanup-worktree-failure-unbounded
title: Native cleanup worktree-removal failure message is unbounded while the branch-delete path is capped at 500 chars
parent: native-redesign
labels: [opencode-seam, worktree, review-followup]
priority: p2
created: "2026-09-28"
updated: "2026-09-28"
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

### 2026-09-29 @Arggon-coordinator
## FINAL APPROVE — PR #432 (`4b561fba`), p2

One functional line, and the review is short because the shape is right. **Merge authorized; this
comment performs no merge and no `done` flip.**

### The change mirrors its sibling exactly — which is the point
The outer per-candidate catch now calls `boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)`
and reuses that one `message` for both `failures[]` and `pruned[].error`, exactly like the
branch-delete catch PR #428 fixed one function above. Same helper, same cap, same single variable
feeding both surfaces. This is the version of the fix that cannot rot: had the worker derived the
message twice, or used a different cap, the two surfaces would drift apart again — which is how the
inconsistency was born in the first place. The change is also genuinely one line plus a comment; a
p2 that had grown into a cleanup would not have merged.

### The test covers both surfaces, not just the one that was reported
`cleanup prune bounds every per-candidate failure at the shared cap` produces two *different* failure
kinds in one run, and the fixture is arranged so each lands on a different catch:

- **A** — removal is **observed**, then the branch lookup throws. That call has no catch of its own, so it reaches the outer catch, which is the surface this item is about.
- **B** — the domain `remove` throws and `.git` is unlinked so the git fallback also fails, so removal is *not* observed and the worktree-removal surface reports the refusal.

That distinction matters: a test hitting only one catch would have left the sibling surface unpinned,
which is exactly how the original gap survived a previous fix. For each candidate the test asserts
`pruned[].error` equals the flat entry minus its `<id>: ` prefix, `length === 500`, and
`endsWith("…")`, then bounds the **flat entry itself** (`<= 500 + id + separator`) rather than
just the message. Regression proof is the pre-fix shape: `expected 799 to be 500`.

Continuation is pinned by asserting the whole `pruned` array: A's removal is recorded as observed
before the throw, the throw skips record clearing, B is still processed after A's failure,
`commit` is `undefined`, both records and A's branch survive, A's worktree is gone and B's is not.
That is acceptance box 2 as an assertion rather than as an omission.

### The consumer check was actually performed, and it changed the reasoning
Box 4 asked whether anything depends on the full text. The worker checked `cli/src/tui.ts` (no
cleanup surface at all — its `cleanup` hits are a local teardown function), `cli/src/board.ts`
(renders `worktree_path`, never a cleanup envelope), the human CLI path (already clipped at 2000
through `sanitizeHumanError`, and it reads the CLI twin's message, not the native envelope), the
list-mode-only parity pin, and the smoke's happy-path assertion. It then drew the right conclusion:
a **human-displaying** consumer does exist, so the cap must stay generous and truncation must be
**visible** — hence `endsWith("…")` rather than a silent slice.

It also named the one ambiguity in the other direction (a short error that legitimately ends in an
ellipsis could read as clipped) and answered it by pinning the exact length as well as the mark. That
is the level of care this bar asks for.

### CLI twin: noted, not absorbed
Box 5 satisfied without scope creep. `cli/src/cleanup.ts:197` has the identical unbounded outer catch
and `:176` the branch-delete catch that never reaches `failures`. Crucially the worker also recorded
*why* the CLI is not a one-liner: it has **no `boundedNativeText` equivalent**, and its nearest tools
(`sanitizeHumanError`/`clipHumanValue`, 2000 chars) are the human-output path, so importing them
into a JSON envelope would drag human-channel escaping into a machine surface. That is exactly the
reasoning that keeps the CLI fix from being a wrong one-liner, and it is now recorded on
`bug-cli-cleanup-branch-delete-missing-failure` so the next agent does not re-derive it.

### One pre-existing shape I am explicitly *not* filing
The worker noted that the inner removal surface joins its step errors with `"; "` and then caps the
**join**, so with a long first error the later steps (`git worktree removal failed`,
`worktree remains at …`) fall off the cap. I checked and agree it is pre-existing and unchanged. I am
deliberately not filing it: the message is bounded by design, and keeping the *head* (the root cause)
rather than the tail is the defensible choice — a follow-up asking to preserve the tail would trade
the most useful part of the error for the least. Recording the decision here so it is not mistaken for
an oversight.

### Gates
98 files / 1690 tests · `lint` · `build` · `check:plugin` (40 modules, 375 976 B, `git
diff --exit-code` clean) · `lint:structure` 0 findings · `test:structure` 3 passed ·
`validate --json` `ok:true`. CI `36503000164` (`cli`, `ui-smoke`) and `36503000090`
(`tasks-validate`) success on this head. Diff is `index.ts` +3/−1, the regenerated bundle, and
`tools.test.ts` +132 — nothing outside the plugin and the two item files.
