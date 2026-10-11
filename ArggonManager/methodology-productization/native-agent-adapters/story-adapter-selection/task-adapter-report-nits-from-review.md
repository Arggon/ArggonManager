---
type: task
status: todo
id: task-adapter-report-nits-from-review
title: "`doctor --agents` non-blocking review nits: README sample shows a pre-round-2 human line; json-output.md has a half-merged adopter-edited clause; counts row omits acknowledged buckets; matrix assertion omits `replaced`"
parent: story-adapter-selection
labels: [docs, tests]
created: "2026-10-03"
updated: "2026-10-03"
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

## Notes

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
