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
