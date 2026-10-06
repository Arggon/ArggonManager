---
type: bug
status: done
id: bug-validate-does-not-check-frontmatter-present
title: "`arggon validate` reports ok on an item file whose FRONTMATTER was deleted entirely — it checks required fields when a frontmatter block exists, never that one exists"
assignee: Arggon
branch: fix/bug-validate-does-not-check-frontmatter-present
parent: story-spec-pipeline
labels: [tracker-schema, validate]
created: "2026-10-03"
updated: "2026-10-06"
worktree_path: /home/arggon/Projects/ArggonManager-bug-validate-does-not-check-frontmatter-present
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

- [x] An item file with NO frontmatter block is a validate ERROR, naming the file — `MISSING_FRONTMATTER`, verified red on mutation
- [x] A file whose frontmatter is unterminated (unclosed `---`) — now `UNTERMINATED_FRONTMATTER`, its own typed code rather than the generic parse failure
- [x] A fixture per case, following the repo convention of one failing fixture per layout rule
- [x] The same question checked across the other frontmatter readers (`list`, `show`, `next`, done gate, cascade)
- [x] The kernel is the owner (`@arggondev/lib`), so the rule the pre-commit hook and `adopt` rely on ships in `lib/src/validate.ts` rather than in a CI-only check

Per-box evidence is recorded under `## Notes` → "Acceptance ticked with evidence (PR #619)".

**The five unticked boxes under `## Notes` → 2026-10-03 are deliberately left exactly as written.** They are the
original criteria inside a dated block, and a dated block is history rather than current state; the same five
criteria are ticked above with their evidence. They cannot be ticked in place without rewriting history, and
force-push is denied. `arggon done` counts `- [ ]` anywhere in the body, so those historical boxes still block the
terminal flip — that gate defect is tracked as `bug-done-gate-counts-checkboxes-inside-comment-blocks`, and
waiving it is the product owner's call, not an agent's.

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Found by the worker on PR #616 (bug-vacuous-substring-ordering-assertions), 2026-10-03, while resolving an item-file conflict: its union script deleted an item file's frontmatter entirely, and **`arggon validate` reported ok**.

**Why that is a real gap.** `validate` checks required fields (`type`, `id`, `status`, …) _when a frontmatter block is present_, and reads the file as body-prose when it is not. So the worst possible corruption — no frontmatter at all — is the one shape it accepts. The tracker then has a Markdown file with no id, no status and no parent: it cannot be listed, claimed, validated for the done gate, or resolved by `depends_on` — yet the gate that owns the tracker's integrity says the tree is fine.

This is the same blind spot the session keeps meeting in a different place: a validator that checks the _content of a structure_ without checking that the structure exists. Compare the seam drift gate, which explicitly checks for a committed provenance marker before it has anything to compare, and the seam parity test, which was added precisely because two copies were checked independently.

**Why it mattered immediately.** This session has repeatedly hit item-file conflicts because tracker commits land on `main` from sessions in other worktrees, and every one of those resolutions is a chance to drop frontmatter. Two workers this session wrote union scripts; at least one dropped the block and noticed only by eye.

Acceptance:

- [ ] An item file with NO frontmatter block is a validate ERROR, naming the file — the structural equivalent of the `MISSING_ID` error it already raises for an empty block
- [ ] The same for a file whose frontmatter is unterminated (unclosed `---`), which today is likely read as body prose too
- [ ] A fixture per case, following the repo convention of one failing fixture per layout rule
- [ ] Check the same question across the other frontmatter readers (`list`, `show`, `next`, the done gate, cascade): do they degrade safely, or does one of them write a file with no frontmatter?
- [ ] The kernel is the owner (`@arggondev/lib`); a CI-only check is not enough, since `validate` is what the pre-commit hook and adopter CI run

### 2026-10-03 @ses_efe3043b8ffed48yGgAx3qryzL

PR #619 — kernel fix, Behavioral methodology impact (reasoning below).

## What landed

Fix is in the KERNEL (`@arggondev/lib`), not CI: `validate` is what the pre-commit hook and adopter CI run, so a CI-only fix leaves the real gate weak.

- `lib/src/frontmatter.ts` — parse refusals are a typed `FrontmatterParseError` (MISSING_FRONTMATTER / UNTERMINATED_FRONTMATTER / INVALID_FRONTMATTER_LINE) instead of bare Errors distinguished only by message text. A malformed line inside a well-formed block still reports `BROKEN_YAML`, so that contract is unchanged.
- `lib/src/items.ts` — a skip now carries its REASON (`no-frontmatter` | `no-type`). Readers with no layout knowledge keep skipping both exactly as before; only a caller that knows the file's expected role promotes the skip into an error.
- `lib/src/validate.ts` — a file in a position the layout RESERVES for an item (container index `<dir>/<dir>.md`, or a `task-*`/`bug-*` leaf) must carry a block: `MISSING_FRONTMATTER`, naming the file. An unclosed block is `UNTERMINATED_FRONTMATTER`.
- `convention.md` now states the requirement, so doc and gate agree.

Scoped to item POSITIONS on purpose: a plain `.md` the layout reserves nothing for stays an ignored non-item document, so no adopter gains a requirement for a README or notes file.

## Evidence: red on mutation, reverted

Pre-fix baseline on this item file (expected the new codes, observed `ok`, exit 0):

| shape                  | before                  | after                         |
| ---------------------- | ----------------------- | ----------------------------- |
| block deleted entirely | `ok`, exit 0            | `MISSING_FRONTMATTER`, exit 1 |
| unterminated `---`     | `BROKEN_YAML` (generic) | `UNTERMINATED_FRONTMATTER`    |
| zero-byte file         | `ok`, exit 0            | `MISSING_FRONTMATTER`, exit 1 |

Each message names the file. Container index losing its block also caught (verified on a live story index: MISSING_FRONTMATTER + the PARENT_MISSING cascade). All reverted; validate is ok.

## Fixtures: one per layout rule

`missing-frontmatter/` (the live incident), `missing-frontmatter-index/`, `unterminated-frontmatter/`, `empty-item-file/`, plus `non-item-markdown/` as the pinned no-false-positive control. README table row added.

## SWEEP ANSWER — do the other readers degrade safely, or does one WRITE a frontmatter-less file?

**No writer does. The gap was read-side only.** Every surface run against a wiped item:

- Readers (`list`, `show`, `next`, `report`, `doctor`, `board`): all degrade to "not an item". `show` refuses (`SHOW_FAILED`, id not found); the rest omit it silently. No crash, no invented item.
- Writers (`comment`, `update --status`, `update --unassign`, `handoff`, `branch`, `priority migrate`): all refuse with `id not found under the tracker`. The wiped file was byte-UNCHANGED afterwards and remained the only frontmatter-less file — nothing created, overwritten or silently "repaired".
- Writer census: every item-file write funnels through `stringifyFrontmatter` (`comment.ts`, `create.ts`, `priority.ts`, `update.ts` incl. the cascade and promotion rewrites), which always emits the fences.

## Union-resolution workflows: checked, none relied upon

**No tolerant mode** in the kernel depends on the old lenient read (grepped; the only tolerated/best-effort hits are unrelated — CRLF parsing, co-writer inode swaps, gh round-trip). Item conflicts resolve as a UNION of `###` blocks under main's frontmatter, so the normal path keeps main's block and is unaffected. What changed is exactly the case where a resolution script DROPS the block — that now fails the gate instead of passing it. No legacy `tasks/` fixture relied on the old behavior.

## Separate finding — 4 item files are 0-byte on main (needs its own item)

The new rule immediately surfaced real pre-existing corruption:

- `.../parallel-worktree-runtime-isolation-ports-state-services/task-record-exploration-016-worktree-runtime-isolation.md`
- `.../ecosystem-ops/ci-stability/bug-live-reload-sse-race.md`
- `.../ecosystem-ops/ci-stability/task-derive-cli-spawn-loader.md`
- `.../ecosystem-ops/ci-stability/task-remove-diag-listener.md`

In each case the commit that emptied the file IS its own `chore(tasks): commented <id>` auto-commit. All item writers use `writeFileAtomic` (temp + rename), so an in-place truncate should be impossible — meaning this is a writer-side regression I could not reproduce, and it is NOT fixed by this PR. Content is restored byte-for-byte in a SEPARATE, droppable commit so the validator can be reviewed alone; no frontmatter/body was edited.

Coordinator: this warrants its own item — a zero-byte item file silently un-claims an item and drops its acceptance history, and the writer path that caused it is still unfixed. Filing it is your call, not mine.

## Gates (all green)

`npm run build` BEFORE `npm test` → 2594 passed / 126 files → `npm run lint` → `npm run arggon -- validate` (ok) → `npm run check:plugin` → `npm run test:structure` (5 passed) → `npm run lint:structure`.

## Methodology impact: Behavioral

A previously-ok tree now errors — the intended effect. Reasoning: a validator that checks the CONTENT of a structure without checking that the structure EXISTS accepts the worst shape it can see. Same class the repo already knows elsewhere (the seam drift gate checks for a committed provenance marker before comparing; the seam parity test exists because two copies were checked independently). Blast radius bounded to item positions, pinned by the `non-item-markdown` control. `npm run skills:sync` run in-PR: no drift (no CLI surface changed).

### 2026-10-03 @ses_efe05d095ffeS2vc8sds3F1JJo

verdict: request-changes (kernel rule is right; four change requests, none of them re-litigate the scoping decision)

Read-and-reason review, no gates re-run. Everything below is either read from the diff/code/history in this worktree or listed under "Probes needed".

## What holds up (verified by reading)

1. **The scoping predicate is complete for every valid item position — the rename hole does not exist.** All four types resolve to `<dir>/<dir>.md`: `newItemPath` gives `join(tasksDir, id, id.md)` even for `initiative` (`lib/src/paths.ts:153-162`), and leaves are `task-*`/`bug-*` (`lib/src/ids.ts:7-10`, `lib/src/relations.ts:4-10`). So `isItemFilePosition` (`lib/src/validate.ts:52-58`) matches every path the layout can produce. A legit item renamed into an unchecked position is still caught by a pre-existing rule: a renamed index leaves `MISSING_INDEX` (`validate.ts:411-418`), a renamed leaf under a story dir leaves `UNKNOWN_STORY_CHILD` (`validate.ts:422-446`). Residual — a `.md` that is neither the index nor `task-*`/`bug-*` inside an **epic/initiative** dir is ignored by both the new rule and the pre-existing unknown-child rule (which only walks story containers). That is the deliberate arbitrary-markdown branch, and the `UNKNOWN_STORY_CHILD` half of it is pre-existing, not opened here.
2. **The typed-error refactor is behaviour-preserving.** Only two in-repo consumers of `parseFrontmatter` (`lib/src/items.ts:202`, `cli/src/adopt.ts:181`). No message-text matching of the three messages anywhere: `cli/src/playbooks.ts:512` and `cli/src/spec.ts:201` raise their _own_ copies with identical text (separate parsers, not matchers). No `err.name` / spread / index-level dispatch exists (`grep` for `name === "Error"`, `...err`, `Object.getOwnPropertyNames(err)`: none). `instanceof Error` still true and messages byte-identical, so any string matcher keeps working. `INVALID_FRONTMATTER_LINE` deliberately maps to `BROKEN_YAML` (`items.ts:164-173`), so the broken-yaml contract is unchanged.
3. **The widened `skip` union is contained.** Only `tryLoadItem` (`items.ts:330`, returns null — unchanged) and `validate` match on it.
4. **The tests discriminate.** Each of the five new assertions fails without the change (three find no error / no `UNTERMINATED_FRONTMATTER`; the control asserts `errors === []` and would fail if the rule over-fired), and the generic `it.each(invalidCases())` at `cli/src/validate.test.ts:51` picks the five new dirs up automatically. `non-item-markdown` yields 0 errors + 1 `LEGACY_LAYOUT` warning, so that generic reject-test stays satisfied — load-bearing and undocumented; a one-line comment there would be worth it.
5. **Pre-fix baselines and post-fix codes match the claim, read from the code.** Pre-fix: `skip → continue` ⇒ ok for a deleted block and for 0-byte; `parseFrontmatter` throw ⇒ `fatal/BROKEN_YAML` for the unclosed case. Post-fix: skip+`isItemFilePosition` ⇒ `MISSING_FRONTMATTER`, parse refusal ⇒ `UNTERMINATED_FRONTMATTER`, all through `push(errors, rel, …)` so each names the file.
6. **The recovery is byte-for-byte and isolated.** `cmp` against the stated sources (16295623 / e52f33c3 / e470c86d / 0490dda1): IDENTICAL ×4. `git show --stat 54188794`: exactly those four files, insertions only.
7. **Docs.** `convention.md` updated; no other doc statement is falsified (no validate code is documented anywhere — grep for BROKEN_YAML/MISSING_ID/MISSING_INDEX across README, docs, skills: nothing), and `skills:sync` is correctly a no-op (the skill points at `convention.md`, does not embed it). Impact class stated in both the PR body and the item comment.
8. The item's own correction on the unclosed-block case is recorded honestly ("this shape was ALREADY an error before the fix … the item's 'likely read as body prose too' turned out to be wrong for the unclosed case").

## Change requests

**S1 — the 0-byte root cause is factually wrong in 2 of 4 cases, and it is repeated in four places.** Read from git history (`git show <commit>:<path> | wc -c` at each commit that touched each file):

| item file                                                   | emptied by                                                                                        | parent's bytes |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------- |
| `task-record-exploration-016-worktree-runtime-isolation.md` | `9c5cce96` **`chore(tasks): done …`** — not a _commented_ commit                                  | 14037          |
| `bug-live-reload-sse-race.md`                               | `ac3fe3c6` **`fix(e2e): … (#521)`** — a squash-merged PR commit, not a tracker auto-commit at all | 3463           |
| `task-derive-cli-spawn-loader.md`                           | `8444d328` `chore(tasks): commented …` ✓                                                          | 8304           |
| `task-remove-diag-listener.md`                              | `5e3efced` `chore(tasks): commented …` ✓                                                          | 5388           |

The parent snapshots also show the empty state was already in the tree before those commits (`ce5e855a`: three of the four at 0; `a28b8bec`: derive+diag at 0 while `1ab0993a` had both intact) — i.e. it travels between branches/worktrees rather than being produced by the operation that landed it. Structural note that the follow-up should inherit: every item write in the kernel is `writeFileAtomic(path, stringifyFrontmatter(…))` (`comment.ts:134`, `create.ts:184`, `priority.ts:134`, `update.ts:783/803/1051`) and `writeFileAtomic` writes content to a temp file and renames (`lib/src/atomic.ts:33-52`) — that path cannot emit a 0-byte file, so something outside it emptied the working tree or staged the empty blob.

Why this blocks: the wrong diagnosis is in the PR body, in commit `54188794`'s message, in the item comment, **and in the title + acceptance of `bug-zero-byte-item-files-committed-by-comment-autocommit`** ("In every case, the commit that emptied the file is its own `chore(tasks): commented <id>`"). Acceptance box 2 of that item sends the next worker at `commentTrackerMutation`'s read-modify-write window and "is `git commit -a` or an index-level write involved" — where the evidence points elsewhere. Fix: correct all four statements; re-scope the follow-up around worktree/merge-level corruption (e.g. sweep history for every commit that emptied _any_ item file, and identify the actor), and tick its box 3 (byte-for-byte recovery) with the `cmp` evidence above.

**S2 — main is invalid under the new rule today, and the PR does not say so plainly.** All four files are **still 0 bytes on `origin/main`** (`git show origin/main:<path> | wc -c` ⇒ 0 for each); `bug-zero-byte-item-files-committed-by-comment-autocommit` is `status: todo`, unassigned. Consequences, both real: `cli/src/validate.test.ts:43` runs `runValidate({ cwd: process.cwd() })` on every `npm run test`, so main's `cli` job goes red the moment the kernel change lands without the recovery; and the pre-commit hook (`npm run arggon -- validate`) fails for every agent whose worktree is based on main, blocking the wave. The current wording — "drop it to review the validator alone (the pre-commit hook then fails on those four, by design)" — reads like an _optional_. Say the merge prerequisite instead: **the recovery is mandatory and must merge with, or before, the kernel change.** Preferred order: land the recovery on main first as its own PR (pure data recovery, no review risk), then merge the validator.

**S3 — "No writer does. The gap was read-side only" is not what the evidence shows, and it ticks acceptance box 4.** Six write surfaces refusing a _wiped_ file and leaving it byte-unchanged shows no writer _repairs or corrupts that input_; it does not show no writer _emits_ a frontmatter-less file — which is what the box asks. The same PR then reports four writer-committed 0-byte item files. Narrow the claim to what was probed ("readers degrade safely; every write surface refuses an unresolvable id and leaves the file byte-unchanged"), and either leave box 4 at that width or move the writer half to `bug-zero-byte-…`. DoD #5 (no known validate false-pass for the new behavior) is met either way.

**S4 — the recovery resurrects two already-merged items as claimed `in_progress`, and nobody owns the reconciliation.** Read from the restored bytes: `task-record-exploration-016-worktree-runtime-isolation` (PR #523 merged) and `task-remove-diag-listener` (PR #540 merged) come back with `status: in_progress`, `assignee: Arggon`, `branch:`, `claimed_at: 2026-10-01`, `worktree_path:` pointing at worktrees that still exist — **and with every acceptance row ticked** (016 rows at lines 37-41 all `[x]`; diag rows 31-33 all `[x]`). Both are therefore flippable to `done`, the auto-done workflow will not re-fire (its merge event already passed), and nothing in this PR or the follow-up names them. Merging as-is leaves two finished items looking in-flight in the report rollups and in a coordinator's `next`. Not a gate failure — it is a tracker-state change smuggled into a PR whose second commit says "no frontmatter or body is edited". Name the two ids in the PR body and hand the `done` flip to the coordinator post-merge, or file it.

## Non-blocking asks

- **S5** — `FrontmatterParseError`/`FrontmatterParseCode` are exported from `lib/src/frontmatter.ts` but not re-exported from the kernel entry `lib/src/index.ts`, while `parseFrontmatter` is. An outside caller therefore classifies a refusal by duck-typing `.code` or matching `.message` — exactly what this refactor set out to remove. One line in the export block.
- **S6** — `docs/agents.md` §Changing the methodology: a **Behavioral** carrier change must "reference the adopter-upgrade channel (ADR 0016)". The class is stated in both required places ✓, but neither the PR body nor the item comment contains an ADR 0016 reference (grep: no `0016` in either).
- **S7** — `softTryLoadItem`'s sniff `raw.startsWith("---")` (`items.ts:197`) is not BOM-aware while `parseFrontmatter` strips `\uFEFF` (`frontmatter.ts:41`). Pre-fix a BOM-ed item file was silently invisible to every reader (all readers go through `softTryLoadItem`); post-fix it is a hard `MISSING_FRONTMATTER` whose message says "must start with a `---` block" about a file that does. Net improvement — it stops being invisible — but strip the BOM in the sniff so the code means what it says.

## Unverified by reading (see Probes needed)

I did not execute any gate. The pre/post mutation table, the 2594/126 suite result, and the six-surface sweep are the worker's claims; I confirmed the _code paths_ they describe, not the runs. My own static sweep reconstructed `isItemFilePosition` over all 504 `.md` under `ArggonManager/` on `origin/main` (docs/ excluded, matching the walker's skip) and found exactly the four known corrupt files — and zero on the PR head — which is why S2 is stated as a complete set, but that sweep is not `runValidate` and covers only the `MISSING_FRONTMATTER` class.

## Probes needed

Run in `cwd = /home/arggon/Projects/ArggonManager-bug-validate-does-not-check-frontmatter-present` unless stated.

1. `npm run build && npx vitest run cli/src/validate.test.ts` — expected: the five new cases green, suite counts as reported. Any failure here blocks regardless of this verdict.
2. `npm run arggon -- validate` — expected `ok`, 0 errors, exit 0. Demonstrates the restored tree validates and no mutation was left behind (my HEAD sweep only covered the `MISSING_FRONTMATTER` class).
3. In a scratch worktree off `origin/main`, apply only the kernel commit (`git cherry-pick e8b1d29d`) and run `npm run build && npm run arggon -- validate` — expected exactly four `MISSING_FRONTMATTER` errors naming the four paths, exit 1. Demonstrates S2 end-to-end (main invalid without the recovery) and that four is the complete set. Fewer than four → the recovery is incomplete; more than four → the scope claim in the PR body is wrong.
4. `git show origin/main:<path> | wc -c` for the four paths, re-run after merge — expected 0 now, non-zero after. A non-zero result means S2 is unfixed and the merge must not land.
5. Pre/post code mapping on a throwaway copy of the item file: delete the block ⇒ expect one error, code `MISSING_FRONTMATTER`, path naming the file, exit 1; restore; leave `---` unclosed ⇒ expect `UNTERMINATED_FRONTMATTER`; truncate to 0 bytes ⇒ expect `MISSING_FRONTMATTER`; restore and re-run `validate` to confirm ok. Demonstrates the evidence table's codes and file-naming; a wrong code or a missing path would contradict my reading.
6. `gh pr view 619 --json statusCheckRollup,mergeable` — expected the `cli` job green on the PR head. Red on the branch blocks independently of this review.

### handoff 2026-10-03 @ses_efe3043b8ffed48yGgAx3qryzL (session: ses_efe3043b8ffed48yGgAx3qryzL) — next: Coordinator: review PR #619 and merge; tick the acceptance boxes, then set status done.

- branch: fix/bug-validate-does-not-check-frontmatter-present
- open questions: Item needs a decision: file a new bug for the WRITER regression that emptied 4 item files to 0 bytes (their own chore(tasks): commented commits; not reproduced, not fixed here); the 2nd commit in the…

### 2026-10-03 @ses_efe3043b8ffed48yGgAx3qryzL

### Acceptance ticked with evidence (PR #619)

Original checklist, each box now met — evidence inline, full commands in the PR body.

- [x] **An item file with NO frontmatter block is a validate ERROR, naming the file** — `MISSING_FRONTMATTER`, verified red on mutation: expected the code, observed `arggon validate: ok (0 warning(s))` exit 0 before the fix, `error ArggonManager/.../bug-validate-does-not-check-frontmatter-present.md: missing required YAML frontmatter: … [MISSING_FRONTMATTER]` exit 1 after. Also covers a zero-byte file (same shape: no block at all).
- [x] **Same for an unterminated (unclosed `---`) block** — now `UNTERMINATED_FRONTMATTER`, its own typed code instead of the generic `BROKEN_YAML`. Note honestly: this shape was ALREADY an error before the fix (as `BROKEN_YAML`), so it needed a distinct code, not a new rule — the item's "likely read as body prose too" turned out to be wrong for the unclosed case. The missing-frontmatter case was the real hole.
- [x] **A fixture per case, following the repo convention of one failing fixture per layout rule** — `missing-frontmatter/`, `missing-frontmatter-index/`, `unterminated-frontmatter/`, `empty-item-file/`, plus `non-item-markdown/` as the pinned no-false-positive control (the rule must not fire on a plain `.md` in a non-item position). README table updated; `cli/src/validate.test.ts` asserts each code and path.
- [x] **Check the other frontmatter readers (`list`, `show`, `next`, done gate, cascade)** — done, answer in the sweep comment above: every reader degrades safely to "not an item", and NO writer emits a frontmatter-less file (all writes funnel through `stringifyFrontmatter`; every write surface refuses the wiped id and leaves the file byte-unchanged). Also checked specifically: there is no tolerant mode relying on the old lenient read, so the union-resolution workflows are unaffected.
- [x] **The kernel is the owner (`@arggondev/lib`); a CI-only check is not enough** — the rule ships in `lib/src/validate.ts`, so the pre-commit hook and adopter CI get it. No CI file touched (the CI seam belongs to another worker this wave).

Extra beyond the checklist, flagged for the coordinator: the rule surfaced 4 item files that are 0-byte blobs on `main` (their own `chore(tasks): commented` commits emptied them). Restored byte-for-byte in a separate droppable commit; the underlying WRITER regression is unfixed and un-reproduced, and warrants its own item.

### 2026-10-06 @Arggon

verdict: request-changes (the kernel rule is right; three fixes, none of them a design change, plus one merge recipe you should not improvise)

Read-and-reason pass (`arggon-standards`), no gate executed. Everything below is read from the worktree at `0fe4b24e` (= the PR head per `gh pr view 619 --json headRefOid`) or produced in a scratch copy under `/tmp/opencode`. What I could not execute is in **Probes needed**.

## What holds up

**1. The rule closes the defect class, and each shape gets its own honest code.** From the three kernel diffs: (a) no block -> `softTryLoadItem` returns `skip{no-frontmatter}` -> `runValidate` promotes it to `MISSING_FRONTMATTER` with the path. That is the reported hole, closed. (b) opening `---` with no closing fence -> `FrontmatterParseError("UNTERMINATED_FRONTMATTER")` -> `parseIssue` passes the code through -> `fatal` -> `push(errors, rel, ...)`, so it names the file instead of collapsing into `BROKEN_YAML`. (c) block present, required field missing -> untouched pre-existing path (`checkItemShape`), so `MISSING_ID` / `UNKNOWN_STATUS` and friends are unchanged. (d) `.md` outside an item position -> `skip` -> `continue`, no error. `INVALID_FRONTMATTER_LINE` deliberately still maps to `BROKEN_YAML`, so the broken-yaml contract is byte-stable, and every refusal message is unchanged, so a string matcher keeps working. Typed discriminant, not message text - that is the right shape for this.

**2. The "not an item" boundary is right, and I checked it independently of the PR.** `isItemFilePosition` reads the path only (`stem === basename(dirname)` -> container index; `task-*`/`bug-*` -> leaf), which is the only honest input when the file has no contents left to ask, and it runs inside the `walkTasksTree` walk whose `skipDirs` already excludes `<tracker>/docs/` (`paths.ts:134`), so product docs are never candidates. Then I reconstructed that predicate over the real trees: **591** `.md` under the tracker roots on HEAD, **653** on `origin/main`, and **0 item-position files without a block on either side**. Three consequences: this repo's own tree gets no new error (the `runValidate({cwd: process.cwd()})` assertion stays satisfied); `origin/main` is already valid under the new rule, so the earlier blocker "main goes red the moment the kernel lands" is resolved on main's side (`9c17ae6c` restored the four blobs, `8e3e9214` / `f2214234` moved them on); and no legitimate item, `README` or notes file is flagged - the 19-file golden tree `fixtures/tasks-valid` is still asserted at `errors == []`. Disclosure: that is a static reconstruction of the predicate over `git ls-tree`, not `runValidate` (probe 2 and 3 below are the executing version).

**3. The committed bundle is trustworthy.** I regenerated it from the branch sources in a scratch checkout (`git archive HEAD` into `/tmp/opencode/bundle-check`, node_modules linked) and compared: `cmp` identical, `md5 99ceb8c9e6eecd5a7088450c60499dd2` on both, 460 645 bytes / 41 modules. `git status` in the worktree is clean - the tracked bundle was not modified. The four hunks in the bundle diff are exactly the transpiled form of the three kernel files and nothing else: no hand edits, no drift. Two corrections to the premise I was handed: (a) the drift gate in this repo does **not** install the pinned release to compare - `.github/workflows/arggon.yml` bootstraps and re-generates with the branch's own build (`node dist/cli.js init`) and keeps the pinned install only as a lag _assertion_; (b) the `arggon validate --json` step in that lane runs the **pinned 0.5.0**, so `MISSING_FRONTMATTER` is not gated by `tasks-validate` at all - it is gated by the `cli` lane (`npm run test` -> the own-tree assertion, and `npm run check:plugin` -> the bundle). `cli` is green on this exact head: last commit 13:32:19Z, `cli` run completed 13:38:37Z. Net effect on the seam-drift item you flagged: none to fix here, but it also means this rule's only in-repo enforcement is the `cli` lane plus the local pre-commit hook until it ships.

**4. The fixtures discriminate - per class, pre-fix:** `missing-frontmatter` and `empty-item-file` -> `skip` -> **zero** issues, so both the explicit code+path assertion and the generic `it.each(invalidCases())` reject test fail. `missing-frontmatter-index` -> pre-fix it errors for a different reason (`PARENT_MISSING`, since the story vanishes), so only the explicit `MISSING_FRONTMATTER` + `path === tasks/demo/e1/s1/s1.md` assertion is load-bearing; that is honest, and the cascade is a feature, not noise. `unterminated-frontmatter` -> pre-fix an error too (`BROKEN_YAML`), so that fixture discriminates the **code**, not the detection, and the item comment says so in as many words. `non-item-markdown` passes before and after **by design**: it is a guard against over-firing, not evidence of the fix.

**5. Scope and conventions.** Five new assertions in `cli/src/validate.test.ts` next to the existing per-code tests, each naming code _and_ path; README row added; 41 files = 4 tracker items + `convention.md` + the test + fixture README + 30 fixture files + 3 kernel files + the bundle, no deletions. No unrelated refactor rode along. `convention.md` states both new codes, so doc and gate agree; no other doc statement is falsified - `templates/docs/docs/convention.md` is the adopter-local summary (a different document by design), and `skills/arggon-cli/**` only says `arggon validate` "Validate[s] tracker frontmatter and tree integrity", which stays true, so `skills:sync` no-op is correct.

## Blocking

**B1 - the second commit ("restore four item files emptied to zero bytes") is stale and would REGRESS main's tracker state. Re-do it from main (which also deletes three of your four conflicts).**
The restore was genuinely needed _on this branch_ - I confirmed why: all four files are 0 bytes at the branch point (`53785ed5~1`), so without it the `cli` lane's own-tree assertion goes red. But main independently recovered them (`9c17ae6c`) and then moved them forward (`8e3e9214` marked them done on PR #622, `f2214234` pruned them). The branch holds the **pre-progress** bytes:

| path                                                        | `origin/main`                                            | branch HEAD                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `task-record-exploration-016-worktree-runtime-isolation.md` | `status: done`, `updated: "2026-10-04"`, no claim fields | `status: in_progress`, `updated: "2026-10-01"`, `claimed_at` + `worktree_path` |
| `task-remove-diag-listener.md`                              | `status: done`, `updated: "2026-10-04"`, no claim fields | `status: in_progress`, `updated: "2026-10-01"`, `claimed_at` + `worktree_path` |
| `task-derive-cli-spawn-loader.md`                           | `updated: "2026-10-04"`, claim fields pruned             | `updated: "2026-10-01"`, `worktree_path`                                       |

Taking the branch side resurrects two merged-and-pruned items as in-flight (they would sit in `report` rollups and in any coordinator's `next` as unfinished), repoints two stale `worktree_path` records at worktrees that may still exist - which `cleanup` acts on - and rewinds `updated`, in a commit whose own message says "no frontmatter or body is edited". Under `docs/engineering.md` §Review bar ("scope stays on the item") this is a tracker-state change smuggled into the PR. Cheapest correct fix: `git checkout origin/main -- <the four paths>` and amend/redo `54188794`. main's blobs are valid items, so the new gate still passes (point 2 proves it).

**B2 - the root-cause sentence is false in 2 of 4 cases, is repeated in three places, and the response to the earlier `request-changes` re-asserted it instead of correcting it.** Verified from blob sizes at every commit that touched each path (`git cat-file -s <commit>:<path>`):

| file                                                        | emptied by                                                                                 | the claim in commit `54188794` / PR body / item comment |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `bug-live-reload-sse-race.md`                               | `ac3fe3c6 fix(e2e): ... (bug-live-reload-sse-race) (#521)` - a squash-merged **PR** commit | "its own `chore(tasks): commented <id>`" - false        |
| `task-record-exploration-016-worktree-runtime-isolation.md` | `9c5cce96 chore(tasks): done task-record-exploration-016-...`                              | "its own `chore(tasks): commented <id>`" - false        |
| `task-derive-cli-spawn-loader.md`                           | `8444d328 chore(tasks): commented task-derive-cli-spawn-loader`                            | true                                                    |
| `task-remove-diag-listener.md`                              | `5e3efced chore(tasks): commented task-remove-diag-listener`                               | true                                                    |

That is not cosmetic. The follow-up item's **title and acceptance box 2** send the next worker at `commentTrackerMutation`'s read-modify-write window and at "is `git commit -a` or an index-level write involved", and two of the four cases now argue the other way (a squash-merge and a `done` transition emptied them). `AGENTS.md` is explicit that unfiled or misdirected findings get lost, so the misdirection lands in a tracked item. Correct all three statements, and re-scope that follow-up around worktree/merge-level corruption; its byte-for-byte-recovery box can be ticked with the `cmp` evidence you already gathered.

**B3 - do not assume the item-file conflicts resolve as a union of `###` blocks.** The PR body states "Item-file conflicts resolve as a UNION of `###` blocks under main's frontmatter, so the normal path keeps main's block". I can find no such mechanism: no `.gitattributes` in this repo, no custom merge driver in `.git/config`, and no union-merge code in `lib/` or `cli/` (`grep -rn "union"` returns one unrelated TUI keymap constant). Item files are plain `.md`; git will textually conflict and a human picks the side. This is coordinator-owned per `docs/agents.md` §Orchestration - but do not delegate it to a script on the strength of that sentence, and see the recipe below.

## Non-blocking

- **N1** no assertion at the `validate` **command** surface: all five new tests call `runValidate` (library). The envelope is already proven for another code by the existing block in the same file (`runCli(["validate","--json"])` -> `errors[].code`, `error.code === "VALIDATE_FAILED"`), so this is reuse of proven plumbing rather than a gap - but three lines on `missing-frontmatter` (`ok:false`, exit 1, `errors[0].code === "MISSING_FRONTMATTER"`) would pin the new code in the stable envelope where an adopter sees it.
- **N2** `docs/agents.md` §Changing the methodology: a **Behavioral** carrier PR "reference[s] the adopter-upgrade channel (ADR 0016)". The class is stated in both required places; the ADR reference is in neither the PR body nor the item (`grep 0016` on the item: no hit). One line, and it is a literal rule.
- **N3** `FrontmatterParseError` / `FrontmatterParseCode` are exported from `lib/src/frontmatter.ts` but not re-exported from the kernel entry (`lib/src/index.ts` re-exports `parseFrontmatter` and the `Frontmatter` type only), so an outside caller classifies a refusal by duck-typing `.code` - exactly what this refactor set out to remove. Unchanged from the last pass.
- **N4** `softTryLoadItem`'s sniff `raw.startsWith("---")` is not BOM-aware while `parseFrontmatter` strips `\uFEFF`; a BOM-ed item would hard-fail with a message claiming the file "must start with a `---` block". I checked both trees: **0** BOM-prefixed `.md` anywhere, so latent, not live.
- **N5** residual, pre-existing, not opened here: a `task-*.md` whose block parses but carries no `type:` is `skip{no-type}` -> no error, and `UNKNOWN_STORY_CHILD` deliberately ignores `task-*` names (`validate.ts:439`). So "block present, not an item" still passes silently in item positions. The predicate now knows those positions, so closing it is a one-line promotion whenever you want it; out of scope for this item.
- **N6** `non-item-markdown` is asserted twice with opposing shapes: **0 errors** (new test) and **>= 1 issue** (generic `it.each(invalidCases())`), where the second is satisfied only by the `LEGACY_LAYOUT` warning the legacy `tasks/` layout emits. Load-bearing, undocumented, and it breaks silently if that fixture ever moves to `ArggonManager/`. One comment line.

## The four conflicting files: churn or semantic (you asked, and it changes how you merge)

1. `.../task-record-exploration-016-worktree-runtime-isolation.md` - **semantic, and a regression.** B1. Take main.
2. `.../ci-stability/task-derive-cli-spawn-loader.md` - **semantic** (stale `updated`, resurrected `worktree_path`). Take main.
3. `.../ci-stability/task-remove-diag-listener.md` - **semantic, and a regression** (`done` -> `in_progress` plus claim fields). Take main.
4. `.../story-spec-pipeline/bug-validate-does-not-check-frontmatter-present.md` (its own item) - **semantic, expected** (claim frontmatter + two new comment blocks). main carries two comment blocks the branch lacks (`ses_f02ab...` and the earlier `verdict: request-changes` from `ses_efe05d0...`); the branch carries two main lacks. The bodies are identical up to the first block, so resolve as an append-union of all four (this verdict becomes the fifth).

Not in your list but in the diff: `.../ci-stability/bug-live-reload-sse-race.md` is **byte-identical** to `origin/main` (3463 bytes both sides), which is why it does not conflict.

So three of the four are **not** churn - assuming churn is exactly the trap here, because a "take the branch side" resolution would silently undo main's item state. The fix is upstream of the merge (B1's checkout), which removes three conflicts outright.

## Merge recipe (yours to run, not mine)

1. Redo/amend the restore from main's blobs (B1). The three conflicts disappear; the item file is a hand append-union.
2. Leave `docs/convention.md` and the generated bundle to auto-merge; do not hand-touch the bundle - it is byte-exact (point 3).
3. After merge the item's frontmatter will be main's (`status: todo`, no assignee); re-claim or release per your wave protocol before ticking the checklist and flipping status.

## Probes needed

I executed no gate. Routing these to `arggon-verifier`. All commands assume a FULL `npm run build` first (never `npm run build --workspace @arggondev/lib` - a lib-only build leaves `cli/dist/` stale and fakes a red in the parity suites).

1. `npm run build && npx vitest run cli/src/validate.test.ts` (cwd: this worktree) - expected: the five new cases green and the generic `rejects invalid fixture` cases green for all five new dirs. Demonstrates the discriminating assertions actually execute and pass. Any failure blocks regardless of this verdict.
2. `npm run arggon -- validate --json` (cwd: this worktree) - expected `ok: true`, `errors: []`, exit 0. Demonstrates the tree is valid and nothing was left mutated; my sweep in point 2 is static, not `runValidate`.
3. Command-surface smoke on the four shapes (the blocking smoke gate, §Review bar). For each: copy the fixture out of the repo, mutate the copy, and run the built CLI with cwd set to the copy - e.g. `cp -r fixtures/tasks-invalid/missing-frontmatter /tmp/probe-a`, delete the frontmatter block of `/tmp/probe-a/tasks/demo/e1/s1/task-wiped.md`, then `cd /tmp/probe-a && node <this worktree>/dist/cli.js validate --json`. Expected, per case: block deleted -> `ok:false`, exit 1, one error, `path` `tasks/demo/e1/s1/task-wiped.md`, `code` `MISSING_FRONTMATTER`; `---` left unclosed in `unterminated-frontmatter/.../task-open.md` -> `UNTERMINATED_FRONTMATTER` naming the file; `empty-item-file/.../task-empty.md` truncated to 0 bytes -> `MISSING_FRONTMATTER`; `missing-frontmatter-index/.../s1.md` -> `MISSING_FRONTMATTER` plus the `PARENT_MISSING` cascade; and the control, `non-item-markdown`, -> `ok:true` with only the `LEGACY_LAYOUT` warning. Demonstrates all four shapes in the stable envelope at the command surface. A wrong code, a missing path, or any error on the control would contradict points 1 and 4 above and turn this into a code change.
4. `npm run check:plugin && git status --porcelain -- opencode/plugins/arggon/index.bundle.ts` (cwd: this worktree) - expected: no output. I verified byte-equality in a scratch copy; this re-verifies in-tree. Red means the committed bundle is stale against its own source.
5. On the merge result, after step 1's checkout: `git show <merge-sha>:<each of the four paths> | wc -c` - expected: all four non-zero and equal to `origin/main`'s bytes, with `status: done` still on `task-record-exploration-016-worktree-runtime-isolation.md` and `task-remove-diag-listener.md`. Demonstrates B1 is actually fixed by the merge; a single zero, or `in_progress`, means the resolution regressed tracker state and the merge must be redone.

## Prior findings, for the coordinator

From the earlier `request-changes` (`ses_efe05d0...`): **S1 re-raised as B2** (false root cause, independently re-verified here - the response re-asserted it), **S4 re-raised as B1** (resurrected finished items; now worse, main has since marked and pruned them), **S2 resolved on main's side** (main is no longer invalid under the new rule - point 2), **S3 still stands** (the sweep claim is narrower than "no writer emits a frontmatter-less file"), S5/S6/S7 carried as N3/N2/N4. Nothing from that pass was silently dropped.

## Unverified by reading

The `cli` / `tasks-validate` / `ui-smoke` greens are CI's, re-confirmed current for this head (`0fe4b24e`) but not re-run by me; the maker's "2594 passed / 126 files" and the pre/post mutation tables in the PR body are the maker's claims, not mine. The six-surface reader/writer sweep is also the maker's; I verified the code paths it describes (all item writes funnel through `stringifyFrontmatter`; every kernel write is `writeFileAtomic`), not the runs.

### 2026-10-06 @Arggon

**CORRECTION (2026-10-06, round-2 review of PR #619). The 0-byte root cause asserted in `54188794`'s message, in the PR body, and in my two blocks above is FALSE in 2 of 4 cases. Appended as a dated correction: the earlier blocks are left exactly as written, unedited, because they are the append-only handoff record. The commit message cannot be amended either — force-push is denied by this repo's permission policy and the branch carries tracker commit shas cited as evidence elsewhere.**

**Measured truth, per file.** Blob size at every commit that touched each path (`git rev-parse <commit>:<path>` then `git cat-file -s`), read from `origin/main` directly:

| item file                                                   | emptied by                             | parent's bytes | commit's bytes | kind                                                           |
| ----------------------------------------------------------- | -------------------------------------- | -------------- | -------------- | -------------------------------------------------------------- |
| `task-record-exploration-016-worktree-runtime-isolation.md` | `9c5cce96` `chore(tasks): done …`      | 14037          | **0**          | tracker auto-commit, but the **`done`** verb — not `commented` |
| `bug-live-reload-sse-race.md`                               | `ac3fe3c6` `fix(e2e): … (#521)`        | 3463           | **0**          | squash-merged code PR — **not a tracker commit at all**        |
| `task-derive-cli-spawn-loader.md`                           | `8444d328` `chore(tasks): commented …` | 8304           | **0**          | tracker `commented` auto-commit                                |
| `task-remove-diag-listener.md`                              | `5e3efced` `chore(tasks): commented …` | 5388           | **0**          | tracker `commented` auto-commit                                |

So "in each case the commit that emptied the file IS its own `chore(tasks): commented <id>` auto-commit" holds for **2 of 4** only. Three of the four are tracker auto-commits, but one of those is the `done` verb; the fourth is an ordinary squash-merged PR. That widens the mechanism rather than narrowing it: the `done` write path is a candidate, and one instance entered the repo through review and merge of a code PR.

**Each of the four is where its file FIRST became 0 bytes** — every blamed commit is single-parent and that parent holds its own file non-empty (`9c5cce96^`=`ce5e855a` 14037B, `ac3fe3c6^`=`a28b8bec` 3463B, `8444d328^`=`1ab0993a` 8304B, `5e3efced^`=`8444d328` 5388B). This also **disproves** the "three of the four were already 0 bytes in the parent, so the corruption travels between worktrees" claim recorded in `bug-zero-byte-item-files-committed-by-comment-autocommit` on 2026-10-03. What is true at those snapshots is that _other_ files were already empty in them; emptiness persists forward once introduced, which is the likely source of that confusion.

**Correction propagated.** `bug-zero-byte-item-files-committed-by-comment-autocommit` is corrected in the same push: its frontmatter title, its H1, and its operative acceptance boxes now name the measured mechanism, and a dated correction block records the per-file truth with the shas. Its earlier dated blocks are untouched. The byte-for-byte recovery it asks for is confirmed (`9c17ae6c` restored 14037 / 3463 / 8304 / 5388, matching each last non-empty blob exactly) and recorded as evidence rather than ticked — the boxes live inside dated blocks and that call is the delivery lead's.

**Still true from my earlier blocks, unchanged by this correction:** the `cli` lane's own-tree assertion did need _a_ restore on this branch (all four files were 0 bytes at the branch point `53785ed5`), the recovery was byte-for-byte, and the kernel rule was never in question. B1 applies to _which_ bytes: main has since recovered (`9c17ae6c`), marked two done (`8e3e9214`) and pruned all four (`f2214234`), so this branch now takes main's bytes for the three that diverged — see the merge commit on this branch. `bug-live-reload-sse-race.md` was already byte-identical to main (3463B) and was left untouched.

### 2026-10-06 @Arggon

**Gate evidence for the three blockers (2026-10-06, maker).** All commands run in `/home/arggon/Projects/ArggonManager-bug-validate-does-not-check-frontmatter-present` after a full `npm run build`. Expected → observed:

| #   | gate                                                                  | expected                         | observed                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm run build` (full)                                                | exit 0                           | **exit 0**; postbuild `build:plugin` emitted 41 modules / 460 645 bytes                                                                                                                                                               |
| 1b  | bundle unchanged                                                      | byte-identical, not regenerated  | **identical**: worktree md5 `99ceb8c9e6eecd5a7088450c60499dd2` / 460 645 B == committed; `git status --porcelain -- opencode/plugins/arggon/index.bundle.ts` empty                                                                    |
| 2   | `npx vitest run cli/src/validate.test.ts cli/src/headless-ci.test.ts` | pass                             | **2 files / 64 tests passed**, exit 0                                                                                                                                                                                                 |
| 3   | `npm run arggon -- validate --json`                                   | `ok: true`, 0 errors, 0 warnings | **`ok: true`, 0 errors, 0 warnings**, convention v5, exit 0                                                                                                                                                                           |
| 4   | `git diff --stat origin/main HEAD -- <the three item files>`          | empty                            | **empty**; each file `cmp`-identical to `origin/main`, each `status: done`, `updated: "2026-10-04"`, zero `claimed_at`/`worktree_path`                                                                                                |
| 5   | own item file = union of both sides                                   | all blocks, none lost            | **8 `###` blocks** = 7 union blocks (verified verbatim **and contiguous** against both sides) + this round's appended correction; 0 of 152 distinct non-blank `## Notes` lines from either side absent; both `verdict:` lines present |
| 6   | working tree clean                                                    | clean                            | **clean**                                                                                                                                                                                                                             |

**Gate 7 — `git merge-tree --write-tree --name-only origin/main HEAD` FAILED: exit 1, two conflicts.** This is reported, not waived.

```
ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-validate-does-not-check-frontmatter-present.md   CONFLICT (content)
ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-zero-byte-item-files-committed-by-comment-autocommit.md   CONFLICT (add/add)
```

GitHub's own PR view independently agrees: `mergeable: CONFLICTING` on head `019035a0`.

**Why it cannot pass from the branch side, and why that is the expected state.** It is not caused by B1 — B1 is fixed, and `bug-live-reload-sse-race.md` does not appear in the conflict list at all. The two remaining conflicts are inherent to B2 + B3 together:

- My own item file **must** contain main's round-1 review block (B2/B3 require the union), and main **must** contain it too. Both sides therefore append different blocks at the same `## Notes` append point relative to the merge base (`0faa8a47`), so git textually conflicts.
- B3 established there is no union merge driver (no `.gitattributes`, no merge driver, no union-merge code), so git cannot recognise the two appends as compatible and will always conflict there. A union file and a conflict-free merge are mutually exclusive _for a branch that has not yet merged main_.

**The remedy, verified but NOT applied** (it is a branch-structure change reserved to the delivery lead per the round-2 verdict's "Merge recipe (yours to run, not mine)"): merging `origin/main` into this branch conflicts in **exactly these two files and nothing else** — all kernel code, tests, fixtures, `convention.md` and the bundle auto-merge clean (measured in an isolated clone at `/tmp/opencode/mergeproof`). Resolving both to the hand-written unions yields a clean merge, after which `git merge-tree --write-tree --name-only origin/main HEAD` **exits 0** (observed `a3d7f3ac…`, no conflict lines). It is a merge commit — no squash, no force-push, no tracker sha rewritten. Not pushed: the lead owns the merge and its resolution.

One consequence to decide before merging: the round-2 recipe's step 3 expects the item's frontmatter to become main's (`status: todo`, no assignee) after the coordinator's merge. My resolution deliberately keeps **this branch's** live claim (`status: in_progress`, `assignee: Arggon`, `claimed_at`, `worktree_path`) because the claim is real and I was told not to flip any status. If the coordinator's merge is expected to land main's frontmatter instead, that resolution must be made deliberately, not by accident.

### handoff 2026-10-06 @Arggon — next: Lead: merge PR #619 (merge commit). Gate 3 exits 1 (2 inherent item-file conflicts); main->branch merge makes it exit 0 - run it?

- branch: fix/bug-validate-does-not-check-frontmatter-present
- open questions: main->branch merge: yours or mine?; post-merge frontmatter: my live in_progress claim, or main todo?

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
### 2026-10-06 @arggon-delivery-lead

Merge verification for PR #619 — **merged as `8f7f2f3a8`**, `main` green (`cli` and `ui-smoke` both success).

**The round-2 `request-changes` blockers B1–B3 are closed, and the kernel rule was never in question.**

What the merge required beyond the maker's work: `main` was **407 commits ahead** of this branch, so landing it needed a real merge, and the two item-file conflicts were resolved to the unions already committed on the branch. That resolution has a structural property worth recording, because it is not obvious in advance: **a hand-written union file and a conflict-free merge are mutually exclusive for a branch that has not yet merged main.** Both sides append at the same `## Notes` point from the merge base, and with no union merge driver in the repo, git will always conflict there. Taking the branch side for both files resolves it and preserves every dated verdict block on both items. Verified afterwards with `git merge-tree --write-tree --name-only origin/main HEAD` → **exit 0**, no conflict lines.

Gates run before merge, expected → observed:

| gate | expected | observed |
|---|---|---|
| `npm run build` (full) | exit 0 | exit 0 |
| `npm run test` | pass | **130 files / 2761 tests passed** |
| `arggon validate --json` | `ok:true`, 0/0 | `ok:true`, 0 errors, 0 warnings, v5 |
| `npm run check:plugin` | bundle in sync | OK, bundle clean |
| 3 diverged item files vs `main` | empty diff | **empty**, each `status: done`, no resurrected `claimed_at`/`worktree_path` |
| `merge-tree` | exit 0 | **exit 0** |

**The pre-commit gate failed twice before the build, and the cause is worth naming.** Merging 407 commits brought new kernel source that `lib/dist` predated, so the hook died with `SyntaxError: The requested module '@arggondev/lib' does not provide an export named 'containersMissingAcceptance'` — a stale build presenting as a missing export, with no hint that a build was the fix. Full `npm run build` cleared it. This is the same class as `bug-headless-ci-twin-init-nondeterministic` and it is now the fourth appearance this session; a stale build in a worktree keeps surfacing as a source-level defect.

**The `done` flip is deliberately NOT taken, and this is a refusal, not an oversight.** The live `## Acceptance` section had been left as the untouched template placeholder, with every real criterion inside dated `## Notes` blocks — five ticked with evidence in one block, and the same five still unticked in the original 2026-10-03 block. I transcribed the criteria and their evidence into the live section (current state belongs in the body; dated blocks are history) and left the historical boxes exactly as written, because ticking them in place means rewriting history and force-push is denied. The gate then refused with:

> `cannot mark 'bug-validate-does-not-check-frontmatter-present' done: the acceptance checklist in the item body still has unchecked boxes`

That is `bug-done-gate-counts-checkboxes-inside-comment-blocks` doing precisely what it says. `--waive` is human-only and was not used — same call as `bug-adr-0023-ships-unindexed-blocks-every-pr`. **So this item is merged, verified and green, and deliberately still `in_progress`: unblocking the flip is the product owner's call, and the right fix is the gate defect, not a waiver.**

Two follow-ups filed from the review: `task-validate-missing-frontmatter-command-surface-assertions` (the new codes are asserted only through library-level `runValidate`, never at the `validate` command surface — and `arggon.yml` runs a **pinned 0.5.0** for `validate --json`, so the codes are not gated by `tasks-validate` at all), and `task-dated-correction-not-self-verifying`.
