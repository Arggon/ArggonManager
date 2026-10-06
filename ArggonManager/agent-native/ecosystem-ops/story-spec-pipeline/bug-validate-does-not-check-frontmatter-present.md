---
type: bug
status: in_progress
id: bug-validate-does-not-check-frontmatter-present
title: "`arggon validate` reports ok on an item file whose FRONTMATTER was deleted entirely — it checks required fields when a frontmatter block exists, never that one exists"
assignee: Arggon
branch: fix/bug-validate-does-not-check-frontmatter-present
parent: story-spec-pipeline
labels: [tracker-schema, validate]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T12:48:00.029Z"
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

| shape | before | after |
| --- | --- | --- |
| block deleted entirely | `ok`, exit 0 | `MISSING_FRONTMATTER`, exit 1 |
| unterminated `---` | `BROKEN_YAML` (generic) | `UNTERMINATED_FRONTMATTER` |
| zero-byte file | `ok`, exit 0 | `MISSING_FRONTMATTER`, exit 1 |

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

**3. The committed bundle is trustworthy.** I regenerated it from the branch sources in a scratch checkout (`git archive HEAD` into `/tmp/opencode/bundle-check`, node_modules linked) and compared: `cmp` identical, `md5 99ceb8c9e6eecd5a7088450c60499dd2` on both, 460 645 bytes / 41 modules. `git status` in the worktree is clean - the tracked bundle was not modified. The four hunks in the bundle diff are exactly the transpiled form of the three kernel files and nothing else: no hand edits, no drift. Two corrections to the premise I was handed: (a) the drift gate in this repo does **not** install the pinned release to compare - `.github/workflows/arggon.yml` bootstraps and re-generates with the branch's own build (`node dist/cli.js init`) and keeps the pinned install only as a lag *assertion*; (b) the `arggon validate --json` step in that lane runs the **pinned 0.5.0**, so `MISSING_FRONTMATTER` is not gated by `tasks-validate` at all - it is gated by the `cli` lane (`npm run test` -> the own-tree assertion, and `npm run check:plugin` -> the bundle). `cli` is green on this exact head: last commit 13:32:19Z, `cli` run completed 13:38:37Z. Net effect on the seam-drift item you flagged: none to fix here, but it also means this rule's only in-repo enforcement is the `cli` lane plus the local pre-commit hook until it ships.

**4. The fixtures discriminate - per class, pre-fix:** `missing-frontmatter` and `empty-item-file` -> `skip` -> **zero** issues, so both the explicit code+path assertion and the generic `it.each(invalidCases())` reject test fail. `missing-frontmatter-index` -> pre-fix it errors for a different reason (`PARENT_MISSING`, since the story vanishes), so only the explicit `MISSING_FRONTMATTER` + `path === tasks/demo/e1/s1/s1.md` assertion is load-bearing; that is honest, and the cascade is a feature, not noise. `unterminated-frontmatter` -> pre-fix an error too (`BROKEN_YAML`), so that fixture discriminates the **code**, not the detection, and the item comment says so in as many words. `non-item-markdown` passes before and after **by design**: it is a guard against over-firing, not evidence of the fix.

**5. Scope and conventions.** Five new assertions in `cli/src/validate.test.ts` next to the existing per-code tests, each naming code *and* path; README row added; 41 files = 4 tracker items + `convention.md` + the test + fixture README + 30 fixture files + 3 kernel files + the bundle, no deletions. No unrelated refactor rode along. `convention.md` states both new codes, so doc and gate agree; no other doc statement is falsified - `templates/docs/docs/convention.md` is the adopter-local summary (a different document by design), and `skills/arggon-cli/**` only says `arggon validate` "Validate[s] tracker frontmatter and tree integrity", which stays true, so `skills:sync` no-op is correct.

## Blocking

**B1 - the second commit ("restore four item files emptied to zero bytes") is stale and would REGRESS main's tracker state. Re-do it from main (which also deletes three of your four conflicts).**
The restore was genuinely needed *on this branch* - I confirmed why: all four files are 0 bytes at the branch point (`53785ed5~1`), so without it the `cli` lane's own-tree assertion goes red. But main independently recovered them (`9c17ae6c`) and then moved them forward (`8e3e9214` marked them done on PR #622, `f2214234` pruned them). The branch holds the **pre-progress** bytes:

| path | `origin/main` | branch HEAD |
| --- | --- | --- |
| `task-record-exploration-016-worktree-runtime-isolation.md` | `status: done`, `updated: "2026-10-04"`, no claim fields | `status: in_progress`, `updated: "2026-10-01"`, `claimed_at` + `worktree_path` |
| `task-remove-diag-listener.md` | `status: done`, `updated: "2026-10-04"`, no claim fields | `status: in_progress`, `updated: "2026-10-01"`, `claimed_at` + `worktree_path` |
| `task-derive-cli-spawn-loader.md` | `updated: "2026-10-04"`, claim fields pruned | `updated: "2026-10-01"`, `worktree_path` |

Taking the branch side resurrects two merged-and-pruned items as in-flight (they would sit in `report` rollups and in any coordinator's `next` as unfinished), repoints two stale `worktree_path` records at worktrees that may still exist - which `cleanup` acts on - and rewinds `updated`, in a commit whose own message says "no frontmatter or body is edited". Under `docs/engineering.md` §Review bar ("scope stays on the item") this is a tracker-state change smuggled into the PR. Cheapest correct fix: `git checkout origin/main -- <the four paths>` and amend/redo `54188794`. main's blobs are valid items, so the new gate still passes (point 2 proves it).

**B2 - the root-cause sentence is false in 2 of 4 cases, is repeated in three places, and the response to the earlier `request-changes` re-asserted it instead of correcting it.** Verified from blob sizes at every commit that touched each path (`git cat-file -s <commit>:<path>`):

| file | emptied by | the claim in commit `54188794` / PR body / item comment |
| --- | --- | --- |
| `bug-live-reload-sse-race.md` | `ac3fe3c6 fix(e2e): ... (bug-live-reload-sse-race) (#521)` - a squash-merged **PR** commit | "its own `chore(tasks): commented <id>`" - false |
| `task-record-exploration-016-worktree-runtime-isolation.md` | `9c5cce96 chore(tasks): done task-record-exploration-016-...` | "its own `chore(tasks): commented <id>`" - false |
| `task-derive-cli-spawn-loader.md` | `8444d328 chore(tasks): commented task-derive-cli-spawn-loader` | true |
| `task-remove-diag-listener.md` | `5e3efced chore(tasks): commented task-remove-diag-listener` | true |

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
