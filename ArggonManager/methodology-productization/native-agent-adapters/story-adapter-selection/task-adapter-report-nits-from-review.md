---
type: task
status: in_progress
id: task-adapter-report-nits-from-review
title: "`doctor --agents` non-blocking review nits: README sample shows a pre-round-2 human line; json-output.md has a half-merged adopter-edited clause; counts row omits acknowledged buckets; matrix assertion omits `replaced`"
assignee: arggon-delivery-lead
branch: feat/task-adapter-report-nits-from-review
parent: story-adapter-selection
labels: [docs, tests]
created: "2026-10-03"
updated: "2026-10-11"
claimed_at: "2026-10-11T09:57:59.738Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adapter-report-nits-from-review
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/task-adapter-report-nits-from-review.md
  Leaves live only under a story. id is the filename stem: task-adapter-report-nits-from-review.
  CLI `arggon create task adapter-report-nits-from-review` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `doctor --agents` non-blocking review nits: README sample shows a pre-round-2 human line; json-output.md has a half-merged adopter-edited clause; counts row omits acknowledged buckets; matrix assertion omits `replaced`

## Context

Five non-blocking findings from the round-2 review of PR #606 (task-adapter-selection-flags), 2026-10-03. The reviewer offered them as \"fix in this PR or file before merge — an unfiled finding is a lost finding\"; the merge is proceeding, so they are filed here rather than lost.

1. **`README.md:292-294`** — the `doctor --agents` sample still shows the pre-round-2 human line (`0 stale, 0 adopter-edited (yours, never overwritten)`), a string the shipped CLI can no longer emit. Introduced by #606 and made stale by #606's own fix; the real shape is pinned in `adapter-selection.test.ts`.
2. **`json-output.md:236`** — a DUPLICATED half-merge: the superseded \"never overwrites it\" clause is still inside the paren, followed by a dangling `)` and then the new \"skips it unless `--backup` archives and regenerates it\" wording. So the contract row prints both claims for the same status — and one of them is the claim the round-1 review specifically ruled out.
3. **`json-output.md:237`** — `agents.agents[].counts` still documents six keys; the code, the sample and the pinned `Object.keys` all have eight (adding `acknowledged` / `acknowledged-drifted`).
4. **Sample caption** — calls all 9 `adopter-edited` rows `docs.modified` entries; 8 are. The 9th (`.opencode/agents/arggon-prover.md`) has NO provenance state, so the `docs` block cannot see it — meaning this tree's own example of the new F1 category is mis-described in the one paragraph meant to explain it.
5. **`adapter-selection.test.ts:274`** — the matrix honesty assertion is `written + skipped === total`; adding `+ counts.replaced` keeps the shipped identity enforced everywhere (harmless today).

Still informational from round 1, also unfiled: `runAdapterReport` re-reads `.convention.yml` via `readGeneratedState` while the `docs` block used the earlier `readConventionConfig` — the \"read once so the two blocks cannot disagree\" argument the matrix comment makes is not applied to the state file.

## Acceptance

Each row is one of the round-2 findings from PR #606 (plus the round-1
informational one), checked against the shipped CLI and the pinned tests on
branch `feat/task-adapter-report-nits-from-review`. A finding already resolved
upstream is ticked with the commit that resolved it rather than re-fixed here.

- [x] README `doctor --agents` sample emits only strings the shipped CLI can emit, cross-checked against the pinned inline snapshot in `cli/src/adapter-selection.test.ts` (`0 adopter-edited (yours; init skips it unless --backup)`; `claude` 2 / `opencode` 18 / `zcode` 23 `file(s)`). Finding 1's pre-round-2 `never overwritten` line was already fixed upstream in `d4a7a436`; the drift still live on this base (`zcode: 19` → `23`) is fixed here.
- [x] `json-output.md`'s `agents.agents[].files` row carries ONE claim for `adopter-edited` — the superseded "never overwrites it" clause and its dangling `)` are gone (finding 2).
- [x] `json-output.md` documents every `agents.agents[].counts` key the code emits and the pinned `Object.keys(entry.counts)` asserts: `total, present, acknowledged, acknowledged-drifted, adopter-edited, stale, missing, unverified, orphaned` (finding 3). The doc's JSON sample's three `counts` blocks are also valid JSON now — each was missing the comma before `orphaned`, so the one JSON sample in that section did not parse.
- [x] The `--agents` sample block in `json-output.md` is re-measured against this repo's own tree (recorded 2026-10-13, commit `fee7979b`) and names no retired seam path: every count, shown row and elision total matches a live `arggon doctor --json --agents` run, `zcode.total: 23` matches README, and its one `adopter-edited` row (`opencode.jsonc`) is the checksum divergence the `docs` block also counts as `modified` (finding 4, re-scoped by the round-2 verdict).
- [x] The matrix honesty assertion enforces the shipped identity `written + replaced + skipped === total` (finding 5).
- [x] The read-once argument is applied to the state file: `runDoctor` reads the convention once and hands `config.generated` to `runAdapterReport`, which no longer re-reads `.convention.yml` through `readGeneratedState`.
- [x] `npx prettier --check` clean on every file this item touches, `arggon validate` green, `npm test` green (pre-existing repo-wide prettier drift reported, not reformatted).
- [x] Every doc edit matches the implemented behavior — each changed field grepped across `README.md`, `ArggonManager/docs/json-output.md`, `ArggonManager/docs/convention.md` and `ArggonManager/docs/agents.md` (§Verification before opening the PR).

## Notes

### 2026-10-11 @ses_ed543078fffeOz1k5gNQ7Y2rB9

## Round-2 nits closed — evidence (commit 33720115, branch feat/task-adapter-report-nits-from-review)

### Gates run (all in the worktree, all green)

| Gate                                                               | Expected       | Observed                                      |
| ------------------------------------------------------------------ | -------------- | --------------------------------------------- |
| \`npx tsc -p tsconfig.json --noEmit\`                              | exit 0         | exit 0                                        |
| \`npx eslint cli/src/doctor.ts cli/src/adapter-selection.test.ts\` | clean          | clean (no output)                             |
| \`npm run test:structure\`                                         | 5 passed       | 5 passed, 0 failed                            |
| \`npm run arggon -- validate\`                                     | ok, 0 warnings | ok (0 warning(s), convention v5)              |
| \`npm test\`                                                       | green          | **136 files / 2927 tests passed** (5 skipped) |
| \`npx prettier --check\` on the 5 touched files                    | clean          | "All matched files use Prettier code style!"  |

Notes on the gates: \`npm test\` needed \`npm run build\` first — this worktree had no \`dist/\`, which is what the pre-existing \`headless-ci.test.ts\` failure was ("run \`npm run build\` first"), not a regression. After the build the whole suite is green. Repo-wide \`prettier --check .\` is **red for 648 files** (pre-existing drift from another lane: lib/src/**, templates/**, smoke/**, and every one of the 596 tracker \`.md\` files, all of which want a blank line after the frontmatter fence). I did not reformat any file outside this item — reported, not touched. Prettier leaves embedded code blocks in markdown alone, so the JSON sample below is safe to hand-fix.

### Finding 1 — README \`doctor --agents\` sample (pre-round-2 human line)

**Already fixed upstream; the remaining drift on this base is fixed here.** The stale string the item quotes (\`0 stale, 0 adopter-edited (yours, never overwritten)\`) is gone — \`git log -L 297,310:README.md\` shows it replaced in **d4a7a436** ("fix(adapters): reaping ignores acknowledged, and README carries the surface", 2026-10-04), after this item was filed (2026-10-03). The current README line reads \`0 adopter-edited (yours; init skips it unless --backup)\`, which is exactly what the pinned snapshot at \`cli/src/adapter-selection.test.ts:605-607\` emits, so no re-fix was needed.

What WAS still live on this base: the sample's \`agent zcode: 19 file(s)\` / \`19 missing\`. That seam is 23 destinations now — \`task-zcode-automations\` grew it, and both pinned surfaces agree (the inline snapshot says \`agent zcode: 23 file(s)\`; a live \`doctor --agents\` reports \`counts.total = 23\`). Fixed. The second README sample (the orphan block, \`agent opencode: 19 file(s) — 17 present … 1 adopter-edited … 1 orphaned\`) is correct as written: 18 current destinations + 1 orphan = 19, and 17 + 1 + 1 = 19, so I left it. The \`arggon-verifier.md\` name in it is also current (the round-2 rename).

### Finding 2 — json-output.md half-merged \`adopter-edited\` clause

Real, still live at \`docs/json-output.md\` in the \`agents.agents[].files\` row (blame: \`7f0191252\`, the orphan-reaping commit, 2026-10-04 — it pasted the round-2 wording in without deleting the round-1 sentence it superseded). Before:

> \`adopter-edited\` (the recorded \`x-generated\` checksum does not match the file — a hand edit landed; a healthy state, because init skips it and never overwrites it), **a hand edit on an ordinary generated file, or on disk with NO provenance state at all** — … and init skips it unless \`--backup\` archives and regenerates it)

After: one claim, no dangling paren —

> \`adopter-edited\` (the recorded \`x-generated\` checksum does not match the file — a hand edit landed on an ordinary generated file, **or** the file is on disk with NO provenance state at all, which \`docs.ts\` treats as adopter-modified too, so this is also the pre-init adopter tree — and in every case init skips it unless \`--backup\` archives and regenerates it)

The removed clause was the one round 1 ruled out ("never overwrites it" — false once \`--backup\` archives and regenerates). \`README.md:293\` paraphrases this status too; it says "which init also refuses to rewrite", which is looser than the contract row but is qualified a sentence later by "No status promises a protection … init does not provide". I left it — flagging it here rather than growing the diff.

### Finding 3 — \`agents.agents[].counts\`

**The contract ROW was already fixed upstream** (same commit, \`7f0191252\`): it now lists all nine keys, and they match the code (\`cli/src/doctor.ts\`'s \`counts\` object) and the pinned \`Object.keys(entry.counts)\` (\`adapter-selection.test.ts:405-415\`, nine entries). Verified by grep, no edit needed.

What was still broken in that section: the doc's **JSON sample** did not parse. All three of its \`counts\` blocks were missing the comma between \`"unverified": 0\` and \`"orphaned": 0\`. Before the fix a parse of every fenced block in the file reported \`INVALID at md line 906: Expected ',' or '}' after property value in JSON at position 658\`; after, all 8 JSON blocks parse. (Prettier's markdown pass does not touch embedded code blocks, which is why this rode along green.)

### Finding 4 — the sample caption

Real, and the item's diagnosis is exactly right. The caption claimed the 9 \`adopter-edited\` rows are "a subset of the 12 the \`docs\` block reports as \`modified\`". They are not: \`docs\` walks \`x-generated\` entries only, so a destination with **no provenance entry at all** is invisible to it. Answering "where is that row's true provenance state reported": **nowhere in \`docs\` — it has none**, and the \`agents\` block is the only surface in the whole report that names it. I confirmed this two ways: the status list in both README and json-output.md defines \`adopter-edited\` as covering "a file on disk with no provenance state at all", and \`cli/src/docs.ts\`'s classifier treats pre-provenance files as adopter-modified.

The caption now says so: 8 of the 9 are checksum divergences that also land among the 12 \`docs\` reports as \`modified\` (the rest being non-adapter destinations), and the 9th is a file with no \`x-generated\` entry at all, which \`docs\` walks over and only this block reports. I deliberately did not re-name the file in the caption — \`.opencode/agents/arggon-prover.md\` no longer exists in this seam (the agents were renamed in \`0d1571e0\`), so naming it would have introduced a fresh stale reference.

### Finding 5 — the matrix honesty assertion

Real, at \`cli/src/adapter-selection.test.ts:285\` (line 274 in the item was pre-shift). Now:

> \`expect(result.adapters.counts.written + result.adapters.counts.replaced + result.adapters.counts.skipped).toBe(total)\`

with a comment saying why the always-zero bucket is asserted anyway: the identity is the one the code ships and the \`--backup\` case below (line ~724) proves, so asserting it everywhere keeps it enforced at every call site rather than only the one that happens to exercise it. The \`--backup\` test still asserts its own form and still passes.

### Round-1 informational — \`readGeneratedState\` vs \`readConventionConfig\`

**Applied, not waived.** \`runAdapterReport\` took its own \`readGeneratedState(opts.root)\` read while \`runDoctor\` had already read the same bytes for the \`docs\` block through \`readConventionConfig\` — the matrix's "read once so the two blocks cannot disagree" argument (\`doctor.ts\`'s \`matrix\` comment) simply did not cover the state file. \`runAdapterReport\` now takes \`state\` as an input and \`runDoctor\` hands it \`config.generated\`.

The asymmetry was worse than a redundant parse, and the new doc comment says so: \`readGeneratedState\` is tolerant (\`lib/src/convention.ts\` returns \`{}\` on a malformed file) while \`readConventionConfig\` throws. So on a malformed \`.convention.yml\` the two blocks disagreed — \`docs\` failed the run while the adapter block reported every file \`adopter-edited\`. One shared read removes both problems.

- Initialized path: \`state: config.generated\` (the read \`docs\` already classified).
- Non-initialized early-return path: still \`state: readGeneratedState(opts.cwd)\`, because that branch never called \`readConventionConfig\` — there is no earlier read to reuse, and \`{}\` is exactly right for a tree carrying no \`.convention.yml\`. Commented in place.

Regression check: I ran \`--json doctor --agents\` before and after the change and diffed the two payloads — **byte-for-byte identical**. I also exercised the non-initialized branch from a throwaway \`git init\` tree (exit 0, \`initialized: false\`, every agent all-\`missing\`) and confirmed the status counters still sum to \`total\` per agent on this tree (2/2, 18/18, 23/23).

### §Verification sweep (grep of each edited field across the four doc surfaces)

\`adopter-edited\` appears in README.md (6), json-output.md (9), agents.md (2), convention.md (0 — it never documents the adapter report). No \`agents.agents[].counts\` reference exists in convention.md or agents.md, so there was no second place to align; agents.md:30 enumerates the \`files[].status\` values (unchanged) and never repeats the counts key list. README's zcode sample now reads 23, matching the pinned snapshot and a live run.

### Not in this diff (reporting, not filing)

1. The \`agents\` section's JSON sample is a 2026-10-02 snapshot whose numbers have drifted with the seam: it shows \`zcode total: 19 / present: 16\` where the seam is now 23 and fully \`present\`, and its caption's "9 adopter-edited rows / 12 modified" also describes that older tree. Re-measuring it means a real \`doctor --json --agents\` run against a tree that reproduces those states (ack the docs first), which is its own item — I did not want this item's numbers silently disagreeing with each other either.
2. \`README.md:222\`'s "never overwritten, not even with \`--force\`" for generated docs is a third phrasing of the protection claim; it looks true (\`--force\` only re-copies the scaffold \`.convention.yml\` and \`templates/*\`) but it is unverified here.
3. The \`arggon-prover.md\` / pre-round-2 agent names that appear nowhere after these edits.

### handoff 2026-10-11 @arggon-maker (session: ses_ed543078fffeOz1k5gNQ7Y2rB9) — next: Open the PR for 33720115; all seven acceptance rows are ticked and green. Standards reviewer: note F1 and F3's contract row were already fixed upstream (d4a7a436, 7f0191252) — check the diff only cla…

- branch: feat/task-adapter-report-nits-from-review
- open questions: Should the agents JSON sample be re-measured (zcode 19/16 vs the live 23/all-present) in its own item? Does README:293 'refuses to rewrite' need the same one-claim tightening as json-output.md? Is RE…

### 2026-10-11 @ses_ed4c5d320ffeScEzxxks3AMgTV

verdict: request-changes (narrow: the doctor --agents sample block in ArggonManager/docs/json-output.md)

Everything else in this item is right. The three things below are all in the one JSON sample block whose CAPTION this PR rewrites, and one of them is a contradiction this PR creates.

## What I read

- git -C /home/arggon/Projects/ArggonManager-task-adapter-report-nits-from-review diff main...HEAD (4 non-tracker files: ArggonManager/docs/json-output.md, README.md, cli/src/adapter-selection.test.ts, cli/src/doctor.ts).
- cli/src/doctor.ts in full around the change: runAdapterReport's opts (L715-760), runDoctor's non-initialized early return (L977-1030) and the initialized call site (L1135-1165).
- lib/src/convention.ts: readConventionConfig and readGeneratedState (both resolve conventionPathForRoot(dir)), the default objects (L341-363).
- cli/src/adapter-selection.test.ts: the pinned inline snapshot (L598-616), BY_AGENT derivation (L59-80), the matrix identity assertion (L282-296) and the --backup test (L714-732).
- ArggonManager/docs/json-output.md §--agents and every fenced JSON block in the file.

## What I verified and what held

**(a) The signature change is coherent and every call site passes a real read.** Expected: state is required, both callers hand over a real projection. Observed: state: Record<string, GeneratedEntry> is a required field on runAdapterReport; type GeneratedEntry is imported (doctor.ts:23) and classifyAdapterFile still takes GeneratedEntry | undefined per entry (doctor.ts:651). Two call sites: the initialized path passes config.generated (the projection of the readConventionConfig(root) that readConventionVersion already performed on the same file), and the non-initialized early return passes readGeneratedState(opts.cwd). No caller was left behind, and no test constructs a runAdapterReport opts object.

**(b) The byte-for-byte claim is checkable from the diff.** Expected: a mechanism, not an assertion. Observed: the mechanism is real and I traced it. Before, runAdapterReport read the state itself via readGeneratedState(opts.root) — and in the non-initialized branch the caller passes root: opts.cwd, so the old call was literally readGeneratedState(runDoctor.cwd), which is what the new code calls. In the initialized branch readGeneratedState(root) and readConventionConfig(root) resolve the same file through conventionPathForRoot and the same parseConventionConfig, so .generated is the same object. The one behavioural difference that could have leaked — readGeneratedState swallows a malformed file as {} while readConventionConfig throws — is now unreachable from the adapter block, because readConventionConfig(root) already either threw or returned. So the two blocks can no longer disagree, which is the round-1 informational finding, correctly applied rather than waived.

**(c) opts.cwd is the right root, not opts.root.** Expected: the non-initialized branch names the same directory the old code read. Observed: it does, exactly — the old read was readGeneratedState(runAdapterReport.opts.root) and that opts.root was set to runDoctor's opts.cwd on that branch, so readGeneratedState(opts.cwd) is a byte-for-byte substitution. runDoctor's opts has no root field, so opts.root would not even compile there. The comment explaining why the branch has no earlier read to reuse is accurate.

**(d) The JSON sample is valid JSON now.** Expected: the three counts blocks parse. Observed: I extracted every fenced json block from ArggonManager/docs/json-output.md and parsed them with node — 8 blocks, 0 invalid. Before the fix the three counts blocks each lacked the comma between "unverified": 0 and "orphaned": 0. That was a real defect and it is fixed.

**(e) Finding 5.** Expected: written + replaced + skipped === total. Observed: adapter-selection.test.ts:285-293 asserts exactly that, with a comment saying why the always-zero bucket is asserted anyway; the --backup test at L732 asserts its own form of the same identity and still passes.

## What requests the change

**1. This PR creates a contradiction between two samples of the same command.** README.md:302 now reads `agent zcode: 23 file(s) — 0 present … 23 missing` — which is correct, and which I confirmed against the pinned inline snapshot at cli/src/adapter-selection.test.ts:615 (`agent zcode: 23 file(s) — 23 present`). But the json-output.md --agents sample, in the same release, states `"total": 19` for zcode. counts.total is defined in the very table this PR rewrites as "over EVERY file the agent's seam defines — current destinations and orphans alike — independent of the files cap", so it is a pure function of the seam, and the seam is 23 destinations. Before this PR both docs said 19 and agreed; after it they contradict each other about the same run of the same command on the same tree, and the doc explicitly calls that sample "re-measurable with arggon doctor --json --agents".

**2. The sampled path names a file no seam materializes.** json-output.md:962, inside the block whose caption this PR rewrites, carries `"path": ".opencode/agents/arggon-coordinator.md"`. That agent id was retired in the rename (this repo's x-generated records .opencode/agents/{arggon-delivery-lead,arggon-maker,arggon-standards-reviewer,arggon-verifier}.md; see ArggonManager/.convention.yml:84-99), and the maker's own comment says exactly this about the caption: ".opencode/agents/arggon-prover.md no longer exists in this seam (the agents were renamed in 0d1571e0), so naming it would have introduced a fresh stale reference". The reasoning was applied to the caption and not to the body 30 lines above it. json-output.md:852 carries three more retired ids in a second sample.

**3. The caption this PR writes asserts live-tree numbers I cannot verify by reading.** The new caption claims 9 adopter-edited rows, 8 of which land among the 12 the docs block reports as modified, and the 9th carrying no x-generated entry at all. The sample body agrees with the caption (0+6+3 = 9) but describes an older tree, so the caption's split is currently unverified. If the 8/1 split is wrong, this PR has introduced a false statement; if it is right, the sample body is the only thing wrong and the fix is mechanical.

## What I need

Minimum, in this PR:

- Replace or annotate `.opencode/agents/arggon-coordinator.md` in the sample so no line of the contract names a retired seam path (one line, unambiguously in scope — it is the same file and the same block as the caption this PR edits).
- Either re-measure the sample block (init --full on a fixture + arggon adopt --ack to reproduce the acknowledged / adopter-edited states, then paste the real counts) or annotate the block as a dated snapshot whose numbers no longer describe the live seam, and stop calling it "re-measurable".

Preferred: re-measure. It removes the README/json-output contradiction at the same time, and it is the item's own headline standard ("README sample shows a string the shipped CLI can no longer emit") applied to the sibling. If the delivery lead would rather file it as a dedicated item, that is a legitimate call — but then the README 19→23 edit and the json-output 19 cannot both land in the same release.

## Probes needed (I ran nothing)

1. cd /home/arggon/Projects/ArggonManager-task-adapter-report-nits-from-review && npm run build && npx tsx cli/src/cli.ts doctor --json --agents — demonstrates the live per-agent counts. If zcode counts.total is 23 and the adopter-edited split is not 8/1, both the sample body and the new caption are wrong and the change request stands; if the caption's 8/1 is wrong only, the caption needs the fix, not the whole block.
2. Same cwd: npx vitest run cli/src/adapter-selection.test.ts cli/src/init-docs.test.ts — demonstrates the touched suites are green (the matrix identity, the --backup identity and the rewritten orchestration assertions).

## Note for the delivery lead (cross-item, not this item's scope)

ArggonManager/docs/json-output.md:852 and :962 carry retired agent ids in --agents samples. The guard added by the sibling item bug-adopter-engineering-template-software-locked sweeps templates/docs/** for exactly this class but not ArggonManager/docs/**, and the two smokes/agents.md samples are outside both sweeps. This wants its own item: retired seam ids in the shipped doc samples, with the same family-walk treatment the adopter templates just got.

### 2026-10-13 @arggon-maker

## Round-2 verdict closed — the `--agents` sample block is re-measured (not annotated)

Re-measurement route, as preferred. Measured on a clean tree at `fee7979b` after `npm run build`; the sample block in `ArggonManager/docs/json-output.md` now equals a live run field by field.

- Command: `npm run arggon -- doctor --json --agents` (run before and after the doc edits — identical counts).
- Assert: extracted the doc's fenced `agents` block and compared it programmatically against the live payload — per-agent counts, every shown `files[]` row, every elision total, the `matrix` block: `ALL CHECKS: PASS`; the block also parses as JSON.
- Verdict item 1 (README/json-output contradiction): live `zcode.total` is 23 (23 present), not 19 — the sample now says 23 and matches `README.md:302`, so the README 19→23 edit and this doc land consistent.
- Verdict item 2 (retired seam path): the block's opencode row is now `opencode.jsonc`, the live report's one `adopter-edited` file. No retired seam path remains in the block. `arggon-coordinator|arggon-reviewer|arggon-worker` still appear at `json-output.md:857` in the plain (non-`--agents`) `doctor` sample — the verdict assigns that instance to its own item; flagged to the delivery lead, not touched here.
- Verdict item 3 (caption asserted a live-tree split): the live tree has ONE `adopter-edited` row, not nine. The caption now states the recorded snapshot (2026-10-13, commit `fee7979b`), the abridgement rule, and the relation it can prove: `opencode.jsonc`'s recorded `x-generated` checksum no longer matches the bytes on disk, so it is also one of the `docs` block's `modified` destinations. Independent recompute: 62 managed entries → 44 untouched, 5 acknowledged-equal, 6 acknowledged-drifted, 7 non-acked checksum mismatches (incl. `opencode.jsonc`) — exactly the live `docs` block.
- The claude counts in the sample (total 2, present 1, acknowledged 1) needed no edit — they already matched the live run. The zcode elision marker moved 18→22 (1 shown of 23).

Why not the fixture route the verdict sketched: measured on a throwaway `git init` tree — `arggon init --full` reports every file `present`; then `arggon adopt --ack` reports `acknowledged` everywhere except the two always-`present` vendored plugin copies (`.opencode/plugins/arggon/index.ts`, `tui.tsx`); a hand edit after the ack reports `acknowledged-drifted`. A full ack re-baselines every state entry, so a fixture cannot carry plain `acknowledged` and plain `adopter-edited` at the same time — this repo's own tree is the tree that does, which is why the real run is the honest sample.

Gates (all in this worktree): `npm run build` green; `npx vitest run cli/src/adapter-selection.test.ts cli/src/doctor.test.ts cli/src/prose-format.test.ts cli/src/mcp-doc-contract.test.ts` → 4 files / 114 tests passed; `npm test` → 149 files / 3247 tests passed; `npm run lint` exit 0; `npm run test:structure` 5 passed / 0 failed; `arggon validate` ok (0 warnings); `prettier --check` clean and byte-stable under `--write` on both touched files. The item file was normalized by the repo's configured on-edit formatter (`opencode.jsonc` `formatter.prettier`) — kept so the touched file passes its prettier gate; `json-output.md` was already clean and changed only in the intended lines.

### handoff 2026-10-13 @arggon-maker (session: ses_eccb87007ffeeFHz2H0AoqSYDN) — next: PR #762 (commit 0bb45d64) is open on feat/task-adapter-report-nits-from-review: verdict items 1-3 closed by re-measuring the --agents sample; hand to standards review.

- branch: feat/task-adapter-report-nits-from-review
- open questions: json-output.md:857 retired agent ids -> verdict says own item; caption cites commit fee7979b (date+hash) - keep or date-only? fixture cannot carry acknowledged+adopter-edited together.
