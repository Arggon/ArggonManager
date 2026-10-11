---
type: task
status: in_progress
id: task-measure-kernel-refusal-rate
title: "Measure our illegal-action rate: how often do agents attempt transitions the kernel refuses? (AutoHarness's opening datum)"
assignee: arggon-delivery-lead
branch: feat/task-measure-kernel-refusal-rate
parent: harness-research-transfer
labels: [methodology, telemetry, research]
priority: p2
created: "2026-10-05"
updated: "2026-10-11"
claimed_at: "2026-10-11T22:29:04.116Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-measure-kernel-refusal-rate
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-measure-kernel-refusal-rate.md
  Leaves live only under a story. id is the filename stem: task-measure-kernel-refusal-rate.
  CLI `arggon create task measure-kernel-refusal-rate` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Measure our illegal-action rate: how often do agents attempt transitions the kernel refuses? (AutoHarness's opening datum)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

F2 of [exploration-021](../../../docs/explorations/exploration-harness-research-transfer-021.md),
from [AutoHarness (arXiv:2603.03329v1, Google DeepMind)](https://arxiv.org/abs/2603.03329v1).

AutoHarness opens with a **rate**: 78% of Gemini-2.5-Flash's losses in the Kaggle
GameArena chess competition were attributed to _illegal moves_ — not bad strategy, actions
the environment forbids. The whole paper follows from that number: fix the plumbing.

We are the environment. ArggonManager has **171 `throw new Error` sites in `lib/src/`**
implementing the refusal layer — invalid status transitions, `assertParentEdge`, a create
that must be claimed before completing, blocked-requires-a-reason, never-steal-a-claim,
never-reopen-`done`/`cancelled`, and cleanup's still-claimed refusal (m6). That is
AutoHarness's _action-verifier_, hand-designed.

**And we have no idea how often it fires.** `report --trend` mines git history for weekly
completions and cycle time — commits, not refusals. Nothing counts them. So the first
question AutoHarness asks of any agent is unanswerable in this repo.

This is deliberately the **cheapest** item in the batch and it is **falsifiable in an
afternoon**. The point is to close a standing plausibility either way:

- **High refusal rate** → AutoHarness's thesis has a target here, and
  `task-explore-harness-research-transfer` should be reclassified (it is currently a
  spike; a substrate change is greenfield and owes the six-phase protocol, ADR 0017).
- **Near-zero** → AutoHarness is closed for this repo, and we did not spend a week
  proving it.

## Acceptance

- [ ] Counts kernel refusals over a stated window (suggest N = last 8 weeks) from a named
      source: session logs, the tracker's own recorded refusals (`START_FAILED`, `CANNOT_*`,
      reopen/steal refusals), or PR/CI output — whichever actually exists. **If no source
      records them, that is itself the finding** — say so and stop; do not build telemetry
      inside this item
- [ ] Reports a **rate with a denominator** (refusals per agent action or per item
      lifecycle transition), not a raw count. A count without a denominator cannot answer
      AutoHarness's question
- [ ] Breaks the rate down **by rule**, so the top offenders are named. A single aggregate
      number is less useful than "these three rules account for 80%"
- [ ] States the **measurement's own limits** explicitly (what is not captured, and why
      the rate could be understated — e.g. an agent that never attempts the illegal move
      because a doc told it not to would show zero refusals _and_ zero violations, which
      are different findings)
- [ ] Cross-checks one rule against something other than the log: e.g. compare the
      never-reopen refusal against the tracker's actual `done`/`cancelled` history
- [ ] One-line verdict on the item: does AutoHarness's thesis have a target in this repo,
      yes or no — with the number attached
- [ ] If the answer is "high", file the follow-up as a tracked item (do not scope it
      here); if "near-zero", record the closure and link it from exploration-021's
      Recommendation so the next reader does not re-litigate
- [ ] `arggon validate` green; PR opened. **Advisory** unless a telemetry surface is
      actually added, in which case say which and why

## Notes — kernel-refusal measurement (2026-10-11 @arggon-maker)

Window: 2026-08-16 → 2026-10-11 (8 weeks; covers the repo's whole life —
first commit 2026-09-03). N = 4,362 commits in window, all commands below run
in the item worktree on `feat/task-measure-kernel-refusal-rate`.

Sources checked, in the order the item names them:

1. Tracker git history — 2,486 `chore(tasks):` auto-commits, all successes.
   Structural reason: `fail()` in `lib/src/operations.ts` returns the error
   envelope with **no commit**, so a kernel refusal leaves no git trace by
   design. Observed refusal events here: **0**.
2. Item bodies — 37 files mention `START_FAILED` / `claim conflict` /
   `must not reopen` etc. Every hit is design prose, intentional test-probe
   evidence, or an incident anecdote (e.g. the suizo claim-race, which records
   a _missing_ refusal). No time series. Observed refusal events: **0**.
3. `report --trend` — mines `+status:` frontmatter diffs for completions and
   cycle time (verified in `lib/src/trend.ts` header). Commits, not refusals.
4. Friction log (`friction --report`): 60 rows in 2 classes, both
   `commandShape: validate`, narrative `no override`. Friction observations,
   not kernel refusals.
5. Auto-done CI warnings — the one rule with an event-level source:
   `auto-done.yml` emits `::warning::` for done-gate refusals, unexpected
   update failures, and illegal `todo`/`blocked → done` flips at merge time.
   Full sweep 2026-10-11: all **497 runs** (2026-09-11 → 2026-10-11), executed
   lines only (script-source echoes excluded): **0 done-gate refusals,
   0 unexpected failures, 0 illegal-transition attempts, 220 success flips**,
   plus 5 merge-time skips that never consulted the kernel (4 `status
'missing'`, 1 `status 'todo' — not flipped`: warned-and-skipped, not
   refused).
6. Local session store (`session_v2`: 4,241 sessions) — exists but is
   machine-local, unattributed across projects, mixes refusal prose (agents
   read item files full of these strings) with tool results, and covers none
   of CI/headless/other-machine attempts. Mining it into a rate is building
   telemetry: out of scope per this item's own stop rule.

Rate finding: durable-source refusal count = **0** over denominator candidates
**1,224** frontmatter status additions in item `.md` files (511 done, 355 todo,
258 in_progress, 10 cancelled, 4 blocked, + containers), **2,486** successful
tracker mutations, **4,362** commits. Stated honestly: the attempt rate is
**unmeasurable from durable sources**; the observed rate is 0 events per 1,224
transitions. That zero is the finding the item asked for ("if no source
records them, that is itself the finding"). For the one rule with an
event-level denominator the rate is exact, not bounded: done-gate merge-time
refusals **0 / 220 flip attempts = 0%** (full 497-run sweep, source 5).

By-rule breakdown: no observed breakdown exists (nothing observed). Static
refusal surface instead (`throw new Error` sites, `lib/src/`): **181 total —
18 in `*.test.ts`, 163 shipped** (the item text says 171, dated 2026-10-05;
drift in both directions since). Agent-facing rules: never-steal
(`rules.ts` ×3: agent `--force`, agent `--steal`, claim-conflict reassign, plus
start/TTY gates), invalid transition (`rules.ts` ×1; `done: ["todo"]`,
`cancelled: ["todo"]` — table unchanged since introduction), never-reopen
(`rules.ts` ×1 + human TTY gate), done-gate (2 reasons,
`unchecked-live-criteria` / `no-live-contract`, one enforcement point in
`update.ts`), blocked-requires-reason (`status.ts` ×2), create/parent guards
(`create.ts` 11, `relations.ts` 3), cleanup still-claimed (`cleanup.ts`), plus
binding-guard and start/worktree input validation. Observed events per rule in
durable sources: **0 across the board**; only the done-gate has an event-level
source at all (CI warnings: full sweep 0 refusals / 220 flips, 5
non-refusal skips).

Limits (why the rate could be understated): refusals are ephemeral by design,
so zero observed ≠ zero attempted; a doc-compliant agent shows zero refusals
_and_ zero violations — different findings, indistinguishable here; direct git
edits bypass the kernel entirely (exhibit below), so the verifier only sees
attempts routed through it; unit tests intentionally trigger refusals
(expected failures, excluded); auto-done covers merge-time flips only, and its
history starts 2026-09-11 (4.5 weeks, not 8).

One-rule cross-check (never-reopen vs terminal history): **0** `done → todo`
or `cancelled → todo` transitions in-window across today's **513** terminal
items (503 done + 10 cancelled; 521 claimable leaves). The four `-status: done`
diff lines are 2 file deletions, 1 rebase-artifact dup-key drop (`8a148c22`),
and 1 `done → cancelled` (`13bbb6fb`, a probe item) — a transition the kernel
table forbids, landed by direct edit under a mimicked `chore(tasks):` message,
i.e. a kernel bypass, not a refusal. Counterweight so this is not read as
"vacuous verifier": ADR 0025 measured **117/482 (24.3%)** leaves would-be
refused under the old whole-body done-gate — the gate has teeth when consulted.

One-line verdict: **No — AutoHarness's thesis has no measurable target in this
repo: 0 recorded kernel refusals per 1,224 lifecycle transitions over the
8-week window (auto-done CI: 0 refusals across 497 runs / 220 flips), so the
illegal-action rate is unmeasurable-and-observably-zero, not high.**

Proposed follow-up (text only — not filed; delivery lead consolidates): the
sweep proposed here already executed after the report first landed (same
existing source, same patterns — no new surface): outcome 0/220 with 5
non-refusal skips. Remaining is a lead call: link this report from
exploration-021's Recommendation and close P1 for this repo (needs the
Recommendation edit, out of maker scope).

### 2026-10-11 @ses_ed2ea49e2ffe6ovgjOhUgxj1iP

Evidence for standards review (all in worktree, branch feat/task-measure-kernel-refusal-rate, commit 8512f734): report --trend mines +status: completions only (trend.ts header); fail() returns envelope with no commit (operations.ts) so refusals leave no git trace by design; 181 throw sites (17 in *.test.ts, 164 shipped) vs 171 stated; strict frontmatter status additions in window: 1224 (511 done / 355 todo / 258 in_progress / 10 cancelled / 4 blocked); 0 done->todo or cancelled->todo transitions across 513 terminal items; only done->cancelled (13bbb6fb) is a direct-edit kernel bypass (table says done: [todo], unchanged since introduction); ADR 0025 static 117/482 would-be-refused is not an attempt rate; auto-done CI spot sample 19 runs: 0 refusal warnings / 19 flips. Prettier check clean on the touched file; arggon validate ok, 0 warnings. Live Acceptance boxes left unticked for the lead.

### handoff 2026-10-11 @ses_ed2ea49e2ffe6ovgjOhUgxj1iP (session: ses_ed2ea49e2ffe6ovgjOhUgxj1iP) — next: Lead: verify report, tick Acceptance, open PR, flip done after merge

- branch: feat/task-measure-kernel-refusal-rate
- open questions: Full 497-run auto-done sweep unfinished; exploration-021 link pending lead call

### 2026-10-11 @ses_ed2ed434cffdHsqB0EV526IjUT

verdict: approve (advisory measurement — 0 recorded refusals per 1,224 transitions)

- Read the worktree diff (1 non-tracker file, the item report +107/-5) — no templates/cli/lib/skills/plugin touches; scope stays on the item
- Standards-reviewer pass: approve, no blocking findings; throw-site split corrected 17/164 → 18/163 in the fix commit
- Verifier probes first round: validate green, prettier red (exit 1); maker fixed with prettier --write (e38f5247), lead re-ran both gates green in the worktree
- Evidence travels with the change: window 2026-08-16→2026-10-11, 6 sources, rate with denominator, honest why-none by-rule, limits, never-reopen cross-check (0 transitions + done→cancelled bypass exhibit), one-line AutoHarness verdict, follow-up proposed as text (not filed)
- Advisory holds: no telemetry surface built, no gate/command added, live Acceptance left unticked for the lead
- Recommendation: merge PR #726 (merge, not squash), then lead ticks Acceptance, links exploration-021, files the sweep follow-up

### 2026-10-11 @ses_ed2ea49e2ffe6ovgjOhUgxj1iP
Full auto-done sweep landed after the report (background job sh_12d1bdb48001ZBpoCsZ586k2UV, completed): 497/497 runs, 2026-09-11 to 2026-10-11, executed log lines only (script echoes excluded by $variable filter). Aggregate: 0 done-gate refusals, 0 unexpected update failures, 0 illegal-transition attempts, 220 success flips. 5 merge-time skips never consulted the kernel (4 status 'missing', 1 status 'todo' warned-and-skipped on bug-native-cleanup-unverified-worktree-removal). Done-gate merge-time refusal rate: 0/220 = 0%. Report body updated to the full-sweep numbers; verdict now cites 497 runs / 220 flips instead of the 0/19 spot sample.
