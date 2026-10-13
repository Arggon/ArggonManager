---
type: task
status: in_progress
id: task-spike-cross-run-lesson-store
title: "Spike: a durable cross-run lesson store — keep what we learned, discard the dead ends (the one idea worth taking from autoctx)"
assignee: arggon-delivery-lead
branch: feat/task-spike-cross-run-lesson-store
parent: external-harness-evaluation
labels: [methodology, evaluation, spike]
priority: p2
created: "2026-10-05"
updated: "2026-10-13"
claimed_at: "2026-10-13T03:19:08.331Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-spike-cross-run-lesson-store
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/external-harness-evaluation/task-spike-cross-run-lesson-store.md
  Leaves live only under a story. id is the filename stem: task-spike-cross-run-lesson-store.
  CLI `arggon create task spike-cross-run-lesson-store` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: a durable cross-run lesson store — keep what we learned, discard the dead ends (the one idea worth taking from autoctx)

## Context

The one adoptable idea from [ADR 0022](../../../docs/adr/0022-decline-autoharness-autocontext-autocompact.md)
(F6 of [exploration-020](../../../docs/explorations/exploration-autoharness-autocontext-autocompact-020.md)).

`autoctx`'s distinguishing move is **keeping the lessons and discarding the dead ends across
runs**. ArggonManager has no equivalent:

- retrospectives are **per-item** — a comment or a handoff scoped to one item's next step
- `arggon report --trend` mines completions and cycle time, not lessons
- `ArggonManager/docs/labs/telemetry-mining.md` is a _protocol_ for mining friction
  signatures after the fact, not a store
- `adopter-feedback/` is a channel
- ADR 0017's greenfield protocol produces exactly this kind of knowledge **per exploration**
  and then does not carry it forward

So the gap is real: **nothing survives the item**. The second agent on a similar problem
re-derives what the first one learned.

This is a **spike**, not a build: the deliverable is a decision about whether a lesson store
earns its keep on our own substrate, with the bar ADR 0022 set — it must not become a second
loop, a second executor outside the permission perimeter, or a generated moving part in the tree.

**Deliberately not scoped here:** adopting `autoctx` to get this for free. ADR 0022 rejected
that; this re-derives the idea on our substrate so the comparison is honest.

## Acceptance

- [x] Classified first (spike / bounded / greenfield) with the ratchet recorded — if the design turns out to be a new subsystem others depend on, it is **greenfield** and goes through the six-phase protocol
- [x] States the **gap** before any design: the concrete question "what does an agent do today that it would do differently if last run's lesson were on the item?" — a design that cannot answer that is rejected
- [x] Evaluates at least three shapes against ADR 0022's bar: (a) a lessons section in the item body,
      (b) a per-area note file the agent must read before claiming, (c) a `docs/labs`-style
      synthesized playbook promoted by a human
- [x] **Decides where the lesson lives so it travels**: ADR 0006's context budget applies —
      anything added to an item or to always-loaded context is paid every session, so a
      bounded size and a `doctor --budget`-style measurement are part of the answer, not an afterthought
- [x] Accounts for **staleness**: a lesson store rots the way `playbook status` rots (90-day threshold). Either it inherits that mechanism or it names why not
- [x] Accounts for **contradiction**: two items learning opposite lessons from one area, and a lesson that stops being true after a change. ADR 0016's propose/absorb channel is the obvious mechanism to evaluate
- [x] Answers the falsifiable question ADR 0022 set: _if this spike shows no value, is that evidence to revisit `autoctx`?_ — decide it now, while nobody is invested
- [x] Recommendation with trade-offs; if greenfield, a spec + `spec analyze` clean before any implementation task (ADR 0017)
- [x] ADR only if the answer changes a carrier, gate or command
- [x] `arggon validate` + `spec validate` green; `spec analyze` reports no NEW finding naming this item

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

The one adoptable idea from [ADR 0022](../../../docs/adr/0022-decline-autoharness-autocontext-autocompact.md)
(F6 of [exploration-020](../../../docs/explorations/exploration-autoharness-autocontext-autocompact-020.md)).

`autoctx`'s distinguishing move is **keeping the lessons and discarding the dead ends across
runs**. ArggonManager has no equivalent:

- retrospectives are **per-item** — a comment or a handoff scoped to one item's next step
- `arggon report --trend` mines completions and cycle time, not lessons
- `ArggonManager/docs/labs/telemetry-mining.md` is a _protocol_ for mining friction
  signatures after the fact, not a store
- `adopter-feedback/` is a channel
- ADR 0017's greenfield protocol produces exactly this kind of knowledge **per exploration**
  and then does not carry it forward

So the gap is real: **nothing survives the item**. The second agent on a similar problem
re-derives what the first one learned.

This is a **spike**, not a build: the deliverable is a decision about whether a lesson store
earns its keep on our own substrate, with the bar ADR 0022 set — it must not become a second
loop, a second executor outside the permission perimeter, or a generated moving part in the tree.

**Deliberately not scoped here:** adopting `autoctx` to get this for free. ADR 0022 rejected
that; this re-derives the idea on our substrate so the comparison is honest.

## Acceptance

- [ ] Classified first (spike / bounded / greenfield) with the ratchet recorded — if the design turns out to be a new subsystem others depend on, it is **greenfield** and goes through the six-phase protocol
- [ ] States the **gap** before any design: the concrete question "what does an agent do today that it would do differently if last run's lesson were on the item?" — a design that cannot answer that is rejected
- [ ] Evaluates at least three shapes against ADR 0022's bar: (a) a lessons section in the item body,
      (b) a per-area note file the agent must read before claiming, (c) a `docs/labs`-style
      synthesized playbook promoted by a human
- [ ] **Decides where the lesson lives so it travels**: ADR 0006's context budget applies —
      anything added to an item or to always-loaded context is paid every session, so a
      bounded size and a `doctor --budget`-style measurement are part of the answer, not an afterthought
- [ ] Accounts for **staleness**: a lesson store rots the way `playbook status` rots (90-day threshold). Either it inherits that mechanism or it names why not
- [ ] Accounts for **contradiction**: two items learning opposite lessons from one area, and a lesson that stops being true after a change. ADR 0016's propose/absorb channel is the obvious mechanism to evaluate
- [ ] Answers the falsifiable question ADR 0022 set: _if this spike shows no value, is that evidence to revisit `autoctx`?_ — decide it now, while nobody is invested
- [ ] Recommendation with trade-offs; if greenfield, a spec + `spec analyze` clean before any implementation task (ADR 0017)
- [ ] ADR only if the answer changes a carrier, gate or command
- [ ] `arggon validate` + `spec validate` green; `spec analyze` reports no NEW finding naming this item

### 2026-10-13 @arggon-maker
### Spike complete — decision: no lesson store; promote into the carriers that already own the topic

PR #761 (docs-only, Advisory) — https://github.com/Arggon/ArggonManager/pull/761

**Classification first: bounded**, ratchet recorded one-way — a new command, a generated lessons surface, a new gate or a package upgrades this to greenfield (ADR 0017) and stops. No spec is owed for the follow-up (ADR 0017's hard gate is greenfield-only); **an ADR was owed**, because the answer changes a carrier (a rule in `docs/agents.md` + a trigger in the generated maker prompt), so ADR 0027 is written Proposed.

**The gap, stated before any design** (acceptance row 2): retention is not the deficit — of the tracker's 746 item docs (6,959,940 B), 423 carry a dated comment record and those records are **3,647,836 B = 52.4 % of the tracker** (largest 131,535 B in one item). Lessons are written per item, unbounded, unindexed. ADR 0024's own context records 10 items as repeat reports of one class; `bug-mcp-budget-contradicted-across-docs` names its lesson "same lesson as the baseline-date mismatch" inside a per-item acceptance line while both stay open and the class recurs a third time (`task-schema-budgets-near-exhaustion`). The two behaviours that would change are named and one of them (dead-end re-attempts) is explicitly **not** measured — no number is claimed for it.

**Three shapes + the declined fourth** (acceptance row 3): (a) item-body section — rejected (read only by whoever resumes that item, dies with it, checkbox rows reach the container cascade's whole-body reader); (b) per-area note, mandatory read — rejected (no trigger, no enforcement point: the claim path reads the item only); (c) curated carrier promoted by a human — **adopted in its existing form**, because `references/pitfalls.md` (9,476 B on demand, 0 B fixed) and `docs/playbooks/<tech>.md` already do it; the missing part is the write path. The `autoctx` automatic-capture shape is declined unchanged from ADR 0022.

**Where it lives / budget** (row 4): one line per lesson, ≤160 chars, mandatory citation; mechanics → `references/pitfalls.md`, technology → playbooks, a refuted approach → an item's `## Context`, a decision → an ADR. Measurement reuses existing surfaces — `context:report --strict`: generated AGENTS.md **2,031 B ≤ 2,048 (17 B free)**, native catalog 12,189 ≤ 12,288 (99 B), MCP 16,296 ≤ 16,384 (88 B), item block 252 ≤ 1,024; `arggon doctor --budget` for the ADR 0006 surfaces. Trigger goes in the generated maker prompt (ADR 0024 §2), never the generated AGENTS.md. One new ceiling proposed: pitfalls.md ≤ 12,288 B.

**Staleness** (row 5): technology inherits `playbook status` (90 d); mechanism lessons carry **no clock** and the reason is recorded — they expire on an event (the mechanism changes), not a date; the mandatory citation is the invalidation pointer, and the residual risk is stated, not hidden.
**Contradiction** (row 6): supersede in place with a dated note, never a juxtaposed second bullet; ADR 0016's propose/absorb evaluated — inherited for shipped carriers (a skill/template edit reaches adopters by proposal), declined in-tree because git already is propose/absorb.

**Falsifiable question decided now** (row 7): this spike shows value, which is **not** evidence about `autoctx` — manual promotion and automatic capture/replay are different capabilities. The trigger to re-open: the same class filed a **third time** after the rule ships, arriving with a candidate that captures lessons **inside our loop** (ADR 0022 revisit clause (b)); a second loop does not re-open it.

**Deliverables:** `ArggonManager/docs/explorations/exploration-cross-run-lesson-store-027.md` (scaffolded via `arggon stack explore`, next free 027); `ArggonManager/docs/adr/0027-cross-run-lessons-promote-into-existing-carriers.md` (Proposed) + index row; live `## Acceptance` section ticked 10/10.

**Gates** (worktree `/home/arggon/Projects/ArggonManager-task-spike-cross-run-lesson-store`, commit ecf4bc25): `arggon validate` ok 0 warnings (also the pre-commit hook); `spec validate` ok 38 docs 0 warnings; `spec analyze` **4 findings, identical to the pre-change baseline, none naming this work**; `adr-index-parity` + `adr-status-doc-contract` **18/18**; prettier --check clean on every authored file. `npm test` is not required for a docs-only change — say so explicitly — the two ADR contract tests were run as the targeted defence. **Pre-existing drift:** the item file carries one blank-line drift and **574 tracker .md files fail the same prettier check on main** (no `format:check` gate exists) — left alone and reported, not fixed in this diff.

**Observed vs expected:** expected the spike to end in a carrier build; observed that the carriers already exist and only the write path is missing, which moves the deliverable from a store to a rule — hence the ADR.
