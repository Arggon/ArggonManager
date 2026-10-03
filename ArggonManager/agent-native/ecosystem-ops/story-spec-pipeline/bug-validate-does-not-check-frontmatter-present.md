---
type: bug
status: todo
id: bug-validate-does-not-check-frontmatter-present
title: "`arggon validate` reports ok on an item file whose FRONTMATTER was deleted entirely — it checks required fields when a frontmatter block exists, never that one exists"
parent: story-spec-pipeline
labels: [tracker-schema, validate]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-validate-does-not-check-frontmatter-present.md
  Leaves live only under a story. id is the filename stem: bug-validate-does-not-check-frontmatter-present.
  CLI `arggon create bug validate-does-not-check-frontmatter-present` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `arggon validate` reports ok on an item file whose FRONTMATTER was deleted entirely — it checks required fields when a frontmatter block exists, never that one exists

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #616 (bug-vacuous-substring-ordering-assertions), 2026-10-03, while resolving an item-file conflict: its union script deleted an item file's frontmatter entirely, and **`arggon validate` reported ok**.

**Why that is a real gap.** `validate` checks required fields (`type`, `id`, `status`, …) *when a frontmatter block is present*, and reads the file as body-prose when it is not. So the worst possible corruption — no frontmatter at all — is the one shape it accepts. The tracker then has a Markdown file with no id, no status and no parent: it cannot be listed, claimed, validated for the done gate, or resolved by `depends_on` — yet the gate that owns the tracker's integrity says the tree is fine.

This is the same blind spot the session keeps meeting in a different place: a validator that checks the *content of a structure* without checking that the structure exists. Compare the seam drift gate, which explicitly checks for a committed provenance marker before it has anything to compare, and the seam parity test, which was added precisely because two copies were checked independently.

**Why it mattered immediately.** This session has repeatedly hit item-file conflicts because tracker commits land on `main` from sessions in other worktrees, and every one of those resolutions is a chance to drop frontmatter. Two workers this session wrote union scripts; at least one dropped the block and noticed only by eye.

Acceptance:
- [ ] An item file with NO frontmatter block is a validate ERROR, naming the file — the structural equivalent of the `MISSING_ID` error it already raises for an empty block
- [ ] The same for a file whose frontmatter is unterminated (unclosed `---`), which today is likely read as body prose too
- [ ] A fixture per case, following the repo convention of one failing fixture per layout rule
- [ ] Check the same question across the other frontmatter readers (`list`, `show`, `next`, the done gate, cascade): do they degrade safely, or does one of them write a file with no frontmatter?
- [ ] The kernel is the owner (`@arggondev/lib`); a CI-only check is not enough, since `validate` is what the pre-commit hook and adopter CI run

### 2026-10-03 @ses_efe05d095ffeS2vc8sds3F1JJo
verdict: request-changes (kernel rule is right; four change requests, none of them re-litigate the scoping decision)

Read-and-reason review, no gates re-run. Everything below is either read from the diff/code/history in this worktree or listed under "Probes needed".

## What holds up (verified by reading)

1. **The scoping predicate is complete for every valid item position — the rename hole does not exist.** All four types resolve to `<dir>/<dir>.md`: `newItemPath` gives `join(tasksDir, id, id.md)` even for `initiative` (`lib/src/paths.ts:153-162`), and leaves are `task-*`/`bug-*` (`lib/src/ids.ts:7-10`, `lib/src/relations.ts:4-10`). So `isItemFilePosition` (`lib/src/validate.ts:52-58`) matches every path the layout can produce. A legit item renamed into an unchecked position is still caught by a pre-existing rule: a renamed index leaves `MISSING_INDEX` (`validate.ts:411-418`), a renamed leaf under a story dir leaves `UNKNOWN_STORY_CHILD` (`validate.ts:422-446`). Residual — a `.md` that is neither the index nor `task-*`/`bug-*` inside an **epic/initiative** dir is ignored by both the new rule and the pre-existing unknown-child rule (which only walks story containers). That is the deliberate arbitrary-markdown branch, and the `UNKNOWN_STORY_CHILD` half of it is pre-existing, not opened here.
2. **The typed-error refactor is behaviour-preserving.** Only two in-repo consumers of `parseFrontmatter` (`lib/src/items.ts:202`, `cli/src/adopt.ts:181`). No message-text matching of the three messages anywhere: `cli/src/playbooks.ts:512` and `cli/src/spec.ts:201` raise their *own* copies with identical text (separate parsers, not matchers). No `err.name` / spread / index-level dispatch exists (`grep` for `name === "Error"`, `...err`, `Object.getOwnPropertyNames(err)`: none). `instanceof Error` still true and messages byte-identical, so any string matcher keeps working. `INVALID_FRONTMATTER_LINE` deliberately maps to `BROKEN_YAML` (`items.ts:164-173`), so the broken-yaml contract is unchanged.
3. **The widened `skip` union is contained.** Only `tryLoadItem` (`items.ts:330`, returns null — unchanged) and `validate` match on it.
4. **The tests discriminate.** Each of the five new assertions fails without the change (three find no error / no `UNTERMINATED_FRONTMATTER`; the control asserts `errors === []` and would fail if the rule over-fired), and the generic `it.each(invalidCases())` at `cli/src/validate.test.ts:51` picks the five new dirs up automatically. `non-item-markdown` yields 0 errors + 1 `LEGACY_LAYOUT` warning, so that generic reject-test stays satisfied — load-bearing and undocumented; a one-line comment there would be worth it.
5. **Pre-fix baselines and post-fix codes match the claim, read from the code.** Pre-fix: `skip → continue` ⇒ ok for a deleted block and for 0-byte; `parseFrontmatter` throw ⇒ `fatal/BROKEN_YAML` for the unclosed case. Post-fix: skip+`isItemFilePosition` ⇒ `MISSING_FRONTMATTER`, parse refusal ⇒ `UNTERMINATED_FRONTMATTER`, all through `push(errors, rel, …)` so each names the file.
6. **The recovery is byte-for-byte and isolated.** `cmp` against the stated sources (16295623 / e52f33c3 / e470c86d / 0490dda1): IDENTICAL ×4. `git show --stat 54188794`: exactly those four files, insertions only.
7. **Docs.** `convention.md` updated; no other doc statement is falsified (no validate code is documented anywhere — grep for BROKEN_YAML/MISSING_ID/MISSING_INDEX across README, docs, skills: nothing), and `skills:sync` is correctly a no-op (the skill points at `convention.md`, does not embed it). Impact class stated in both the PR body and the item comment.
8. The item's own correction on the unclosed-block case is recorded honestly ("this shape was ALREADY an error before the fix … the item's 'likely read as body prose too' turned out to be wrong for the unclosed case").

## Change requests

**S1 — the 0-byte root cause is factually wrong in 2 of 4 cases, and it is repeated in four places.** Read from git history (`git show <commit>:<path> | wc -c` at each commit that touched each file):

| item file | emptied by | parent's bytes |
| --- | --- | --- |
| `task-record-exploration-016-worktree-runtime-isolation.md` | `9c5cce96` **`chore(tasks): done …`** — not a *commented* commit | 14037 |
| `bug-live-reload-sse-race.md` | `ac3fe3c6` **`fix(e2e): … (#521)`** — a squash-merged PR commit, not a tracker auto-commit at all | 3463 |
| `task-derive-cli-spawn-loader.md` | `8444d328` `chore(tasks): commented …` ✓ | 8304 |
| `task-remove-diag-listener.md` | `5e3efced` `chore(tasks): commented …` ✓ | 5388 |

The parent snapshots also show the empty state was already in the tree before those commits (`ce5e855a`: three of the four at 0; `a28b8bec`: derive+diag at 0 while `1ab0993a` had both intact) — i.e. it travels between branches/worktrees rather than being produced by the operation that landed it. Structural note that the follow-up should inherit: every item write in the kernel is `writeFileAtomic(path, stringifyFrontmatter(…))` (`comment.ts:134`, `create.ts:184`, `priority.ts:134`, `update.ts:783/803/1051`) and `writeFileAtomic` writes content to a temp file and renames (`lib/src/atomic.ts:33-52`) — that path cannot emit a 0-byte file, so something outside it emptied the working tree or staged the empty blob.

Why this blocks: the wrong diagnosis is in the PR body, in commit `54188794`'s message, in the item comment, **and in the title + acceptance of `bug-zero-byte-item-files-committed-by-comment-autocommit`** ("In every case, the commit that emptied the file is its own `chore(tasks): commented <id>`"). Acceptance box 2 of that item sends the next worker at `commentTrackerMutation`'s read-modify-write window and "is `git commit -a` or an index-level write involved" — where the evidence points elsewhere. Fix: correct all four statements; re-scope the follow-up around worktree/merge-level corruption (e.g. sweep history for every commit that emptied *any* item file, and identify the actor), and tick its box 3 (byte-for-byte recovery) with the `cmp` evidence above.

**S2 — main is invalid under the new rule today, and the PR does not say so plainly.** All four files are **still 0 bytes on `origin/main`** (`git show origin/main:<path> | wc -c` ⇒ 0 for each); `bug-zero-byte-item-files-committed-by-comment-autocommit` is `status: todo`, unassigned. Consequences, both real: `cli/src/validate.test.ts:43` runs `runValidate({ cwd: process.cwd() })` on every `npm run test`, so main's `cli` job goes red the moment the kernel change lands without the recovery; and the pre-commit hook (`npm run arggon -- validate`) fails for every agent whose worktree is based on main, blocking the wave. The current wording — "drop it to review the validator alone (the pre-commit hook then fails on those four, by design)" — reads like an *optional*. Say the merge prerequisite instead: **the recovery is mandatory and must merge with, or before, the kernel change.** Preferred order: land the recovery on main first as its own PR (pure data recovery, no review risk), then merge the validator.

**S3 — "No writer does. The gap was read-side only" is not what the evidence shows, and it ticks acceptance box 4.** Six write surfaces refusing a *wiped* file and leaving it byte-unchanged shows no writer *repairs or corrupts that input*; it does not show no writer *emits* a frontmatter-less file — which is what the box asks. The same PR then reports four writer-committed 0-byte item files. Narrow the claim to what was probed ("readers degrade safely; every write surface refuses an unresolvable id and leaves the file byte-unchanged"), and either leave box 4 at that width or move the writer half to `bug-zero-byte-…`. DoD #5 (no known validate false-pass for the new behavior) is met either way.

**S4 — the recovery resurrects two already-merged items as claimed `in_progress`, and nobody owns the reconciliation.** Read from the restored bytes: `task-record-exploration-016-worktree-runtime-isolation` (PR #523 merged) and `task-remove-diag-listener` (PR #540 merged) come back with `status: in_progress`, `assignee: Arggon`, `branch:`, `claimed_at: 2026-10-01`, `worktree_path:` pointing at worktrees that still exist — **and with every acceptance row ticked** (016 rows at lines 37-41 all `[x]`; diag rows 31-33 all `[x]`). Both are therefore flippable to `done`, the auto-done workflow will not re-fire (its merge event already passed), and nothing in this PR or the follow-up names them. Merging as-is leaves two finished items looking in-flight in the report rollups and in a coordinator's `next`. Not a gate failure — it is a tracker-state change smuggled into a PR whose second commit says "no frontmatter or body is edited". Name the two ids in the PR body and hand the `done` flip to the coordinator post-merge, or file it.

## Non-blocking asks

- **S5** — `FrontmatterParseError`/`FrontmatterParseCode` are exported from `lib/src/frontmatter.ts` but not re-exported from the kernel entry `lib/src/index.ts`, while `parseFrontmatter` is. An outside caller therefore classifies a refusal by duck-typing `.code` or matching `.message` — exactly what this refactor set out to remove. One line in the export block.
- **S6** — `docs/agents.md` §Changing the methodology: a **Behavioral** carrier change must "reference the adopter-upgrade channel (ADR 0016)". The class is stated in both required places ✓, but neither the PR body nor the item comment contains an ADR 0016 reference (grep: no `0016` in either).
- **S7** — `softTryLoadItem`'s sniff `raw.startsWith("---")` (`items.ts:197`) is not BOM-aware while `parseFrontmatter` strips `\uFEFF` (`frontmatter.ts:41`). Pre-fix a BOM-ed item file was silently invisible to every reader (all readers go through `softTryLoadItem`); post-fix it is a hard `MISSING_FRONTMATTER` whose message says "must start with a `---` block" about a file that does. Net improvement — it stops being invisible — but strip the BOM in the sniff so the code means what it says.

## Unverified by reading (see Probes needed)

I did not execute any gate. The pre/post mutation table, the 2594/126 suite result, and the six-surface sweep are the worker's claims; I confirmed the *code paths* they describe, not the runs. My own static sweep reconstructed `isItemFilePosition` over all 504 `.md` under `ArggonManager/` on `origin/main` (docs/ excluded, matching the walker's skip) and found exactly the four known corrupt files — and zero on the PR head — which is why S2 is stated as a complete set, but that sweep is not `runValidate` and covers only the `MISSING_FRONTMATTER` class.

## Probes needed

Run in `cwd = /home/arggon/Projects/ArggonManager-bug-validate-does-not-check-frontmatter-present` unless stated.

1. `npm run build && npx vitest run cli/src/validate.test.ts` — expected: the five new cases green, suite counts as reported. Any failure here blocks regardless of this verdict.
2. `npm run arggon -- validate` — expected `ok`, 0 errors, exit 0. Demonstrates the restored tree validates and no mutation was left behind (my HEAD sweep only covered the `MISSING_FRONTMATTER` class).
3. In a scratch worktree off `origin/main`, apply only the kernel commit (`git cherry-pick e8b1d29d`) and run `npm run build && npm run arggon -- validate` — expected exactly four `MISSING_FRONTMATTER` errors naming the four paths, exit 1. Demonstrates S2 end-to-end (main invalid without the recovery) and that four is the complete set. Fewer than four → the recovery is incomplete; more than four → the scope claim in the PR body is wrong.
4. `git show origin/main:<path> | wc -c` for the four paths, re-run after merge — expected 0 now, non-zero after. A non-zero result means S2 is unfixed and the merge must not land.
5. Pre/post code mapping on a throwaway copy of the item file: delete the block ⇒ expect one error, code `MISSING_FRONTMATTER`, path naming the file, exit 1; restore; leave `---` unclosed ⇒ expect `UNTERMINATED_FRONTMATTER`; truncate to 0 bytes ⇒ expect `MISSING_FRONTMATTER`; restore and re-run `validate` to confirm ok. Demonstrates the evidence table's codes and file-naming; a wrong code or a missing path would contradict my reading.
6. `gh pr view 619 --json statusCheckRollup,mergeable` — expected the `cli` job green on the PR head. Red on the branch blocks independently of this review.
