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

<!-- The real acceptance criteria; tick each box when met. -->

Each row is one of the round-2 findings from PR #606 (plus the round-1
informational one), checked against the shipped CLI and the pinned tests on
branch `feat/task-adapter-report-nits-from-review`. A finding already resolved
upstream is ticked with the commit that resolved it rather than re-fixed here.

- [x] README `doctor --agents` sample emits only strings the shipped CLI can emit, cross-checked against the pinned inline snapshot in `cli/src/adapter-selection.test.ts` (`0 adopter-edited (yours; init skips it unless --backup)`; `claude` 2 / `opencode` 18 / `zcode` 23 `file(s)`). Finding 1's pre-round-2 `never overwritten` line was already fixed upstream in `d4a7a436`; the drift still live on this base (`zcode: 19` → `23`) is fixed here.
- [x] `json-output.md`'s `agents.agents[].files` row carries ONE claim for `adopter-edited` — the superseded "never overwrites it" clause and its dangling `)` are gone (finding 2).
- [x] `json-output.md` documents every `agents.agents[].counts` key the code emits and the pinned `Object.keys(entry.counts)` asserts: `total, present, acknowledged, acknowledged-drifted, adopter-edited, stale, missing, unverified, orphaned` (finding 3). The doc's JSON sample's three `counts` blocks are also valid JSON now — each was missing the comma before `orphaned`, so the one JSON sample in that section did not parse.
- [x] The sample caption no longer mis-describes the 9th `adopter-edited` row: 8 of the 9 are among the 12 `docs` reports as `modified`, and the 9th carries no `x-generated` entry at all, so `docs` cannot see it and the `agents` block is the only surface that reports it (finding 4).
- [x] The matrix honesty assertion enforces the shipped identity `written + replaced + skipped === total` (finding 5).
- [x] The read-once argument is applied to the state file: `runDoctor` reads the convention once and hands `config.generated` to `runAdapterReport`, which no longer re-reads `.convention.yml` through `readGeneratedState`.
- [x] `npx prettier --check` clean on every file this item touches, `arggon validate` green, `npm test` green (pre-existing repo-wide prettier drift reported, not reformatted).
- [x] Every doc edit matches the implemented behavior — each changed field grepped across `README.md`, `ArggonManager/docs/json-output.md`, `ArggonManager/docs/convention.md` and `ArggonManager/docs/agents.md` (§Verification before opening the PR).

## Notes

### 2026-10-11 @ses_ed543078fffeOz1k5gNQ7Y2rB9
## Round-2 nits closed — evidence (commit 33720115, branch feat/task-adapter-report-nits-from-review)

### Gates run (all in the worktree, all green)

| Gate | Expected | Observed |
| --- | --- | --- |
| \`npx tsc -p tsconfig.json --noEmit\` | exit 0 | exit 0 |
| \`npx eslint cli/src/doctor.ts cli/src/adapter-selection.test.ts\` | clean | clean (no output) |
| \`npm run test:structure\` | 5 passed | 5 passed, 0 failed |
| \`npm run arggon -- validate\` | ok, 0 warnings | ok (0 warning(s), convention v5) |
| \`npm test\` | green | **136 files / 2927 tests passed** (5 skipped) |
| \`npx prettier --check\` on the 5 touched files | clean | "All matched files use Prettier code style!" |

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
