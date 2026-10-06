---
type: story
status: todo
id: story-ci-wall-clock
title: "CI wall clock: concurrency groups, duration-aware sharding, and the `cli` required check (ADR 0023)"
parent: ecosystem-ops
labels: [ci]
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-ci-wall-clock/story-ci-wall-clock.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# CI wall clock: concurrency groups, duration-aware sharding, and the `cli` required check (ADR 0023)

## Context

<!-- Why this story exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef26e3a0dffeCrCyR7114VVZ2H
## Context

CI runs at p50 **350 s** (61 runs measured 2026-10-05) and **72 % of the required `cli` job is one command** (`npm run test`, 252 s). The suite is 128 files / 2680 tests and reports `tests 97%, import 1%, transform 1%` — the cost is real work, already well parallelized (~7.8x), not overhead.

The decision is cross-cutting: it fixes the shape of the **one required check** (`cli`, app 15368, `strict: true`) and couples CI topology to `auto-done.yml`'s hand-posted `cli` check, so it is recorded as an ADR rather than a task.

- Exploration: [`exploration-ci-pipeline-wall-clock-022`](../../docs/explorations/exploration-ci-pipeline-wall-clock-022.md) — the measurements, candidates and rejected options.
- ADR: [`0023-ci-wall-clock`](../../docs/adr/0023-ci-wall-clock.md) — the decision.

## Acceptance

- [ ] `task-ci-concurrency-cancel` merged — superseded runs are cancelled (step 1).
- [ ] `task-ci-shard-wall-measure` merged — the real 4-core shard walls are recorded (step 2's precondition).
- [ ] Duration-aware sharding merged with an **aggregator job named exactly `cli`** that `needs:` the shard jobs, so branch protection's required check keeps reporting (step 2).
- [ ] The `worktree.test.ts` floor is lowered (step 3) — until then every shard topology floors at that one file's duration.
- [ ] p50 `cli` job wall clock is re-measured after step 3 and compared against the 350 s baseline recorded here.

## Notes

**Sequencing is not priority.** This ordering is a delivery recommendation; the product owner sets `priority`.

**The aggregator job is load-bearing.** Branch protection requires a check named `cli`; a matrix emits `cli (1/4)`, `cli (2/4)`, … and **none** of those satisfy it. If the aggregator is ever renamed, `auto-done.yml`'s `post_cli_check` must change in the same PR — the same "one rule, two spellings" discipline `cli/src/ci-seam-pin.test.ts` already enforces for the seam pin.

**Explicitly rejected**, with reasons in the exploration: Vitest pool/isolation/cache tuning (the run is 97 % `tests` phase — the conventional first move, and it is wrong here), plain `--shard` without duration awareness (measured 1.9x imbalance), a merge queue (a release-story ordering change, not a speed fix), `node_modules` caching (already covered by `cache: npm`; 6 % of the job), and narrowing or dropping any gate (violates the review bar).

**Out of scope but recorded:** `auto-done.yml` runs the whole suite inline on the flip tree (~250 s per merge) purely to satisfy the required check on a SHA no workflow will ever run. It is off the PR critical path and gates nothing a developer waits on, so it is deferred rather than fixed.
