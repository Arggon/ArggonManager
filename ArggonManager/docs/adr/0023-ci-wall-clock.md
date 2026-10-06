# 0023 CI wall clock: concurrency groups, duration-aware sharding, and the `cli` required check

- Status: Proposed
- Date: 2026-10-05
- Deciders: @gonzalo (product owner), Arggon delivery lead

Exploration of record:
[exploration-ci-pipeline-wall-clock-022](../explorations/exploration-ci-pipeline-wall-clock-022.md)

## Context

CI runs at a p50 of **350 s** (61 runs measured 2026-10-05), and **72 % of the required
`cli` job is a single command** (`npm run test`, 252 s). The suite is 128 files / 2680 tests
and is already well parallelized (~7.8× effective), so the cost is real work, not overhead:
the reporter's own phase breakdown is `tests 97%, import 1%, transform 1%`.

Three facts shape the decision:

1. **Cost is not a constraint.** This is a public repo; standard runners are free and
   unlimited. `ubuntu-latest` is 4 CPU / 16 GB. Parallelism is free; the only currency is
   wall clock and risk to the merge gate.
2. **Vitest shards by file count, not duration** — a documented behavior, with
   duration-aware sharding still an open feature request (vitest-dev/vitest#9184). Measured
   here, an even 32-files-per-shard split produced shards holding 103.6 s and 198.9 s of
   work: a **1.9× imbalance from an even split**.
3. **Exactly one required check exists**: context `cli`, app 15368, `strict: true`. A matrix
   emits `cli (1/4)`, `cli (2/4)`… — **none of which satisfy a required check named `cli`**.

The same "one rule, two spellings" hazard this repo already documents for the seam pin also
applies here: `auto-done.yml` hand-posts a check run literally named `cli` via the API,
because bot pushes never trigger workflows.

## Decision

Three changes, **in this order**, each independently revertible:

1. **Concurrency groups** on the PR-triggered workflows:
   `group: ci-${{ github.event.pull_request.number || github.ref }}` with
   `cancel-in-progress: true`. Scoped by PR number (not `github.ref`) so two open PRs cannot
   cancel each other. The key must not combine `queue: max` with `cancel-in-progress` — that
   is a workflow validation error.

2. **Duration-aware sharding** of the suite across a matrix, with an **aggregator job named
   exactly `cli`** that `needs:` the shard jobs and is what branch protection keeps
   requiring. The shard split is derived from measured per-file durations, not from
   `vitest --shard`'s file-count split. **The shard count is fixed only after one throwaway
   CI run measures the real 4-core shard wall times** — it is not chosen from the local
   12-core measurements in the exploration.

3. **Lower the floor: `cli/src/worktree.test.ts`** (55–83 s in one file, 12 % of suite time).
   Until it is cheaper or split, every shard topology floors at its duration and step 2's
   return is capped. `task-runcli-import-tsx-migration` is the natural home.

Explicitly **not** part of this decision: pool/isolation/cache tuning, a merge queue, and any
narrowing or removal of an existing gate.

## Consequences

- The critical path stops being "the whole suite" and becomes "the slowest shard", floored by
  one file. That is the step change; the shard count only sets how close to the floor we get.
- **The aggregator job is load-bearing, not cosmetic.** If the aggregator is renamed, branch
  protection's required check never reports and every merge silently stalls. Any rename must
  change `auto-done.yml`'s `post_cli_check` in the same PR — the same discipline
  `cli/src/ci-seam-pin.test.ts` already enforces for the seam pin.
- Shard jobs run the suite in pieces, so a partial failure is a shard failure; failure triage
  must name the shard, and local reproduction needs the matching `--shard` flag.
- Canceling superseded runs means a red run can disappear from the PR if a newer push replaces
  it. That is the intended trade (newest commit wins), and it is why the group is keyed on
  PR number: a cancel must never cross PRs.
- Step 2 costs wall-clock savings only if step 3 follows. Shipping step 2 alone leaves the
  floor where it is.

## Alternatives considered

- **Vitest pool/isolation/cache tuning** (`isolate: false`, `pool: 'threads'`,
  `fsModuleCache`, `NODE_COMPILE_CACHE`). Rejected on measurement: the run is 97 % `tests`
  phase, and Vitest documents that such a run "has little to gain from configuration changes".
  This is the conventional first move and it is wrong here.
- **Plain `vitest --shard`** without duration awareness. Rejected: measured 1.9× imbalance,
  and it leaves the same one-file floor.
- **Merge queue (`merge_group`)** to stop the double PR + push-to-main run. Real savings, but
  it reorders the release story's dependencies (ADR 0018's C3 predicate compares the pushed
  commit against its parent; auto-done re-checks out `main`). A delivery-model change needing
  its own exploration, not a speed fix.
- **Caching `node_modules`.** Rejected: `cache: npm` is already set on `setup-node`,
  `npm ci` is 6 % of the job, and the suite is not install-bound.
- **Dropping or narrowing the smokes / structure gates** to buy latency. Rejected: they are
  BLOCKING by explicit documented design (`ArggonManager/docs/engineering.md` §Review bar).
  Latency bought with a review bar is a regression.
- **Accepting auto-done's ~250 s inline suite run.** Deferred, not rejected: it runs per merge
  on the flip tree purely to satisfy the required check on a SHA no workflow will ever run.
  It is off the PR critical path and gates nothing a developer waits on, so it is recorded
  rather than fixed here.

## Related

- [exploration-ci-pipeline-wall-clock-022](../explorations/exploration-ci-pipeline-wall-clock-022.md)
- [ADR 0018 — update delivery and distribution channel](./0018-update-delivery-and-distribution-channel.md)
- [ArggonManager/docs/ci.md](../ci.md)
- [ArggonManager/docs/engineering.md §Review bar](../engineering.md#review-bar-blocks-merge)
