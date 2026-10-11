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
