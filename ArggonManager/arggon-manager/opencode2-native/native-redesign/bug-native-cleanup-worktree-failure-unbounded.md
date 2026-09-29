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

### 2026-09-29 @Arggon
Evidence for the review. PR: https://github.com/Arggon/ArggonManager/pull/432 (draft). Head `d9eb40fb`.

## The change (1 functional line)

`opencode/plugins/arggon/index.ts`, outer per-candidate catch of the `cleanup` prune loop (~line 3537):

```diff
       } catch (error) {
-        const message = detail(error)
+        // Same bound as the branch-delete catch above, on BOTH surfaces
+        // (bug-native-cleanup-worktree-failure-unbounded).
+        const message = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)
         failures.push(`${entry.id}: ${message}`)
         pruned.push({ id: entry.id, action: "failed", error: message })
       }
```

Same helper, same 500-char cap, same reused `message` variable for both surfaces as the branch-delete catch at line 3515 — so the two cannot drift. `boundedNativeText` also strips control characters, which the raw path forwarded into a native tool payload. Nothing else changed: continuation, record clearing and the single shared tracker commit are untouched. `index.bundle.ts` regenerated and committed; `npm run check:plugin` exits 0 (no diff after regeneration).

## The new test

`opencode/plugins/arggon/tools.test.ts` → `cleanup prune bounds every per-candidate failure at the shared cap`. One `cleanup prune` over two candidates, each with an over-cap message that still reads like real git/domain prose (no adversarial junk, and the control-character stripping of `boundedNativeText` is deliberately not pinned):

| candidate | how the failure is produced | over-cap input | input length | what BOTH surfaces carried |
| --- | --- | --- | --- | --- |
| A `task-rate-limit` | removal **observed**, then the branch lookup throws — that call has no catch of its own, so it reaches the outer catch (the defect's surface) | `fatal: could not read from the repository: ` + `resolving refs/heads failed against a locked shared ref store; `×12 | 799 | 500 chars, head kept, `…` appended |
| B `task-second` | domain `remove` throws and `.git` is unlinked so the git fallback fails too → removal not observed → the worktree-removal surface | `worktree domain unavailable: ` + `its registration outlived the worktree it names and git no longer lists it; `×11 | 865 | 500 chars, head kept, `…` appended |

For each: `pruned[].error === failures[<flat entry> minus the "<id>: " prefix]`, `length === 500`, and `endsWith("…")` so a clipped error is distinguishable from a short one.

Flat-entry bound (acceptance box 3) is asserted per entry, not just the message:

```ts
expect(flat).toEqual([`task-rate-limit: ${listed}`, `task-second: ${stuck}`]);
expect(flat[0].length).toBeLessThanOrEqual(500 + "task-rate-limit: ".length);
expect(flat[1].length).toBeLessThanOrEqual(500 + "task-second: ".length);
```

The whole `pruned` array is pinned, so the run's continuation is visible: A's worktree removal IS observed (`removed worktree …`) before the throw, the throw then skips the record clearing, and B is still processed after A's failure — `commit` is `undefined`, both records and A's branch survive.

**Expected vs observed.** Reverting the one-line fix (verified by stashing only `index.ts`) fails:

```
AssertionError: expected 799 to be 500
 ❯ opencode/plugins/arggon/tools.test.ts:2627:27
```

With the fix: passes.

One honest note for the next reader, unchanged by this PR and shared with the branch-delete path: the inner worktree-removal surface joins its step errors with `"; "` and then caps the JOIN at 500, so with a long first error the later steps (`git worktree removal failed`, `worktree remains at …`) fall off the cap. That is the pre-existing shape of `boundedNativeText(removal.errors.join("; "), …)`; this PR makes the outer surface match it rather than change it.

## Consumer check (acceptance box 4)

No consumer depends on the full unbounded text. What I checked:

- `cli/src/tui.ts` — **no cleanup surface at all**; its only `cleanup` hits are a local terminal-teardown function (lines 939, 947, 1011). Nothing to depend on.
- `cli/src/board.ts` — the only cleanup-adjacent render is `worktree_path` as a tracker field (line 692); it never reads `failures` or `pruned[].error`, because the board is built from tracker items, not from a cleanup envelope.
- Human CLI display — `cli/src/cli.ts:2405-2420` prints the failure through `sanitizeHumanError()`, which already clips at `MAX_HUMAN_ERROR_CHARS` (2000) and escapes control chars (`lib/src/sanitize.ts:110`). That path consumes the CLI twin's own message, not the native envelope.
- CLI parity — `tools.test.ts:2130` pins cleanup parity for **list mode only**; the prune failure text is not compared across the twin, so bounding the native side creates no parity divergence and breaks no parity test (full suite green).
- Smoke — `smoke/opencode-smoke.test.ts:252` asserts `cleanup?.failures` is `[]` (happy path, no text dependence).

A consumer that *displays* the error to a human does exist: the TUI print of the failure entry. That is a reason to keep the cap generous and a reason to make truncation visible, so: at the cap a reader gets the first 499 characters (the command, the subject, the ref) plus a `…`. Truncation is therefore always detectable and never silent. An ambiguity risk exists only in the reverse direction — a short error that legitimately ends in an ellipsis could read as clipped — which is why the test also pins the exact 500 length rather than the mark alone.

## CLI twin (acceptance box 5)

Unbounded, and noted on `bug-cli-cleanup-branch-delete-missing-failure` rather than fixed here:

- `cli/src/cleanup.ts:197` (outer per-candidate catch): `const message = err instanceof Error ? err.message : String(err)` → pushed to `failures` and `pruned`. **Same unbounded defect as this item.**
- `cli/src/cleanup.ts:176` (branch-delete catch): also unbounded, AND it pushes to `pruned` only — never to `failures`, which is that item's headline defect.

Note the CLI twin is structurally one step behind on the bound (no `boundedNativeText` equivalent there at all), so the fix there is `clip`-shaped rather than a one-line helper call; the CLI has `sanitizeHumanError`/`clipHumanValue` in `lib/src/sanitize.ts`, and that item's acceptance box 1 already asks for a bounded message with the same text on both surfaces. Left untouched per scope.

## Gates (real output)

- `npm test` → `Test Files 98 passed (98)`, `Tests 1690 passed (1690)`, exit 0
- `npm run lint` → exit 0, no output
- `npm run build` → exit 0
- `npm run check:plugin` → `build:plugin — 40 modules inlined, 375976 bytes`, `git diff --exit-code` clean, exit 0
- `npm run lint:structure` → exit 0, no findings
- `npm run test:structure` → `3 passed; 0 failed`
- `npm run arggon -- validate --json` → `{"ok":true,"schemaVersion":1,"conventionVersion":5,"command":"validate","layout":"arggon-manager","errors":[],"warnings":[]}`
- pre-commit hook ran `arggon validate: ok (0 warning(s), convention v5)`

Files changed: `opencode/plugins/arggon/index.ts` (+3/-1), `opencode/plugins/arggon/index.bundle.ts` (+1/-1, regenerated), `opencode/plugins/arggon/tools.test.ts` (+132). Nothing outside those three (no `package.json`, `smoke/**`, `.github/workflows/**`, `lib/src/**`).

Left `status: in_progress` — `done` is the coordinator's call after merge.
