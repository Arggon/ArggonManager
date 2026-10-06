---
exploration_id: ci-pipeline-wall-clock-022
title: Cutting the CI wall clock — where the 350s actually goes
status: resolved
created: 2026-10-05
---

# Exploration: Cutting the CI wall clock — where the 350s actually goes (ci-pipeline-wall-clock-022)

Classification: **bounded** (an existing flow to read and extend — `.github/workflows/ci.yml`
and friends already exist and are the thing being extended). The ratchet is one-way:
nothing found here upgrades this to greenfield, because no new subsystem or interface other
work depends on is introduced.

Origin: a request to "optimize the CI/CD pipeline, it takes too much time" — the demand is
p50 **350 s** per run. This record replaces that vague shape with measured facts, compares
the ways out under explicit criteria, and names one recommendation.

## Ground (measured, not assumed)

All GitHub numbers below are read from the Actions API for this repo on **2026-10-05**; all
local numbers are from this checkout on **2026-10-05** (12 cores / 31 GB — _not_ the CI
runner; see [Measurement caveats](#measurement-caveats)).

### Run-level wall clock

61 `CI` runs: **p50 350 s, p90 370 s, mean 305 s, max 722 s** (min 0 is an in-flight run).
The distribution is tight around ~350 s — this is a steady-state pipeline, not a
pathological one.

### Where the 350 s goes (job `cli`, run `37362522012`, 352 s)

| Step                                      |  Duration | Share of job |
| ----------------------------------------- | --------: | -----------: |
| `npm ci`                                  |      22 s |          6 % |
| `npm run build`                           |      17 s |          5 % |
| `npm run check:plugin`                    |       3 s |          1 % |
| **`npm run test`**                        | **252 s** |     **72 %** |
| `npm run lint`                            |       7 s |          2 % |
| `test:structure` + `lint:structure`       |       1 s |          0 % |
| native-start + worktree-Playwright smokes |       5 s |          1 % |
| checkout + setup-node + teardown          |       4 s |          1 % |

**72 % of the job is one command.** `ui-smoke` runs 125–150 s _in parallel_ and is not a
required check, so it is not on the critical path. The critical path is
`checkout → npm ci → build → test`.

### The suite's own shape (the finding that redirects everything)

`npx vitest run` locally: **86.6 s wall, 128 files, 2680 tests**, and the reporter's own
phase breakdown reads:

```text
Duration  86.57s (tests 97%, import 1%, transform 1%)
```

**97 % of the run is `tests`.** Vitest 5 documents that the percentages are relative to the
sum of tracked phases and that "a run dominated by this phase has little to gain from
configuration changes" (source: https://vitest.dev/guide/improving-performance, accessed
2026-10-05). So the usual first moves — `isolate: false`, `pool: 'threads'`,
`fsModuleCache`, `NODE_COMPILE_CACHE` — target the 3 % that is import/transform plus the
per-file worker cost. **They cannot win here.** This is a negative result worth recording so
the next person does not spend a day tuning pool knobs.

Summed per-file durations = 672.5 s across a 86.6 s wall ⇒ effective parallelism ≈ **7.8×** on
12 cores. The suite is already well parallelized; the cost is real work.

### The cost is extremely concentrated

Slowest files (per-file duration, same run):

| File                                    | Duration | Share of 672.5 s |
| --------------------------------------- | -------: | ---------------: |
| `cli/src/worktree.test.ts`              |   83.4 s |             12 % |
| `cli/src/cli.test.ts`                   |   66.0 s |             10 % |
| `opencode/plugins/arggon/tools.test.ts` |   55.7 s |              8 % |
| `cli/src/measure.test.ts`               |   42.0 s |              6 % |
| `cli/src/success-stdout.test.ts`        |   34.7 s |              5 % |
| `cli/src/tracker-commit.test.ts`        |   29.0 s |              4 % |
| `cli/src/pack-contents.test.ts`         |   23.5 s |              3 % |

**The top 7 files are 50 % of all test time.** 60 751 lines of tests, but the cost is not
spread like that — it is 7 files and their `spawnSync` children.

### Naive sharding, measured

`vitest run --shard=i/4`, run locally:

| Shard | Files | Sum of per-file time |     Wall |
| ----: | ----: | -------------------: | -------: |
|     1 |    32 |              103.6 s |     20 s |
|     2 |    32 |              198.9 s | **57 s** |
|     3 |    32 |              121.5 s |     29 s |
|     4 |    32 |              100.6 s |     36 s |

Full suite 86 s → sharded critical path **57 s. A 34 % cut, not the 75 % four shards
suggests.** The reason is the next finding.

## Criteria

Weighted for this repo (public repo, single-maintainer agent-operated delivery, ~40 runs/day
across all workflows):

1. **Wall-clock reduction on the required check.** Only `cli` gates the merge (branch
   protection requires context `cli` from app 15368, `strict: true`). Optimizing a
   non-required job buys nothing.
2. **Preserve the review bar.** CI _is_ the review bar's automated half here
   (`ArggonManager/docs/engineering.md` §Review bar; `test:structure`, `lint:structure`, the
   plugin-drift gate and both smokes are all BLOCKING by explicit design). A faster pipeline
   that drops a gate trades a bar for latency — not acceptable.
3. **Cost.** Free vs metered. This repo is **public**, where standard runners are "free and
   unlimited" (source: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
   and https://docs.github.com/en/billing/concepts/product-billing/github-actions, accessed
   2026-10-05). So parallelism is free and minutes are not a criterion.
4. **Risk to the delivery loop.** Anything that can wedge auto-done, the `cli` required
   check, or the release guard is disqualified regardless of seconds saved. This repo has a
   documented history of exactly that class of failure (`bug-autodone-flip-wedge-3`,
   `task-autodone-flip-race`, the `#527` seam-pin outage).
5. **Reversibility.** Prefer a change a single revert restores.

## Candidates

- **A. Concurrency groups** — `cancel-in-progress` on the PR-triggered workflow. Pure YAML.
- **B. Matrix-shard the suite** — split `test` across N runners with `--shard` + blob merge.
- **C. Duration-aware shard assignment** — replace Vitest's file-count split with a curated,
  measured split, because the count split is provably mis-assigned here.
- **D. Cut the hot files** — reduce `spawnSync` count in `worktree.test.ts` & friends
  (`task-runcli-import-tsx-migration` already exists for this).
- **E. Pool / isolation / cache tuning** — the "usual" Vitest performance advice.
- **F. Merge queue** — trade the double run (PR + push-to-main) for `merge_group`.
- **G. Stop the redundant test run inside `auto-done.yml`.**

## Findings

### Why the naive 4-way split underdelivers (A–C hinge on this)

Vitest shards **by file count, not by duration** — documented explicitly: "Vitest splits your
_test files_, not your test cases" (source: https://vitest.dev/guide/improving-performance,
accessed 2026-10-05). Duration-aware sharding is a _requested feature_, not a shipped one
(vitest-dev/vitest#9184, opened and still open as of 2026-10-05).

That is exactly wrong for this suite. `--shard=i/4` gave every shard 32 files but shard 2
198.9 s of work and shard 1 only 103.6 s — a **1.9× imbalance from an even file count**.
Worse, the arithmetic floor: `worktree.test.ts` alone is 55.7 s in the sharded run, so **no**
assignment of the current file set into 4 shards finishes below ~56 s. Sharding hits a hard
wall set by one file, not by the shard count.

This is why candidate **C** (duration-aware assignment) beats **B** (plain `--shard`): it is
the same mechanism with the one input that is measurably wrong corrected. It still floors at
`worktree.test.ts` — which is why **D** is not optional but _sequenced first_.

### Concurrency is real waste, not theoretical (A)

No workflow in this repo declares a `concurrency:` block. Per-branch `CI` run counts over the
last 60 runs: `feat/task-role-model-report-only-detector` 4, `feat/task-adapter-orphan-reaping`
4, and three branches at 2. Every push while a run is in flight queues **another full 350 s
run**; without `cancel-in-progress` the superseded run still consumes a runner to completion
and still reports a check on a stale SHA.

GitHub's semantics make this safe and one line: with
`group: ci-${{ github.event.pull_request.number || github.ref }}` + `cancel-in-progress: true`
the newest commit wins and the stale run is cancelled (source:
https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#concurrency,
accessed 2026-10-05). Note the same key must **not** carry `queue: max` — that combination is
a workflow validation error.

The documented pattern is `group: ci-${{ github.ref }}`; scoping by PR number instead keeps
two PRs from cancelling each other, which the `github.ref` form does not.

### Runner shape is the reason sharding is the only real lever (B, C)

`ubuntu-latest` on a public repo is **4 CPU / 16 GB**, and standard runners on public repos are
free and unlimited (source: https://docs.github.com/en/actions/reference/runners/github-hosted-runners,
accessed 2026-10-05). So: the `cli` job's 252 s test step is running 128 files through 4
cores, there is no budget argument against running them on 4 machines instead of 1, and no
cost argument for staying at one.

### Caching is already correct — no win here

Both jobs already set `cache: npm` on `setup-node`, which is the documented minimal
configuration; `npm ci` costs 22 s and the suite is 97 % test execution, so install time is
6 % of the job. There is no `node_modules` caching win to take, and `NODE_COMPILE_CACHE` is
explicitly only worth enabling when the directory survives between runs (source:
https://vitest.dev/guide/improving-performance, accessed 2026-10-05) — it would have to be
added to a cache to pay off at all.

### The `cli` required check constrains every topology change (B, F)

Branch protection requires exactly one context: `cli`, from app id 15368, with
`strict: true` (read from the branch-protection API, 2026-10-05). A matrix emits contexts named
`cli (1/4)`, `cli (2/4)`… — **none of which satisfy a required check called `cli`.** Any
sharded topology therefore needs an **aggregator job that is itself named `cli`** and
`needs:` the shard jobs, or the merge gate silently never reports. This is a real design
constraint, not a detail; it is the same class of coupling that made the auto-done flip
brittle, so it belongs in the ADR.

The same constraint applies to `auto-done.yml`, which posts its own check run literally named
`cli` via the API (`post_cli_check`) because bot pushes never trigger workflows. Any rename
must be updated in both places — the same "one rule, two spellings" hazard the repo already
documents for the seam pin.

### auto-done runs the whole suite again, on every merge (G)

`auto-done.yml` runs `npm test --silent && npm run lint --silent` inline (line ~120) on the
flip tree before pushing, then posts the `cli` check itself. On a 4-core runner that is
another ~250 s of test execution **per merge**, on top of the PR run and the push-to-main run.
It exists only to satisfy branch protection on a SHA that no workflow will ever run.

It cannot simply be dropped: the flip commit is a new SHA, and the previous run's `cli` check
does not transfer to it. The honest options are (a) accept it, (b) narrow it to the changed
surface, or (c) merge via the API in a way that does not require a fresh check. (c) is an
ops/authority decision, not a CI-speed one.

### Merge queue is a delivery-model change, not a speed fix (F)

Today every merge runs CI twice: once for the PR, once for the push to `main`. A merge queue
would run it once on `merge_group`. But `push: main` also fires `release`, `release-please`,
`arggon` and `auto-done`, and those have documented ordering dependencies
(ADR 0018's C3 predicate compares the pushed commit against its parent; auto-done re-checks
out `main`). Changing that topology touches the release story's invariants and the flip PR's
retry logic. It is out of scope for a speed fix and belongs in its own decision.

### Measurement caveats

- Local numbers are from a **12-core** machine; the CI runner has **4**. Ratios (86 s → 57 s)
  transfer; absolute seconds do not. The CI-side shard timings must be measured by one
  throwaway CI run before any shard count is fixed in the workflow — that measurement is filed
  as follow-up work rather than guessed here.
- Per-file durations in shard 2 are lower than in the full run (55.7 s vs 83.4 s for
  `worktree.test.ts`) because a full run has 12 cores contending and a shard has fewer files
  to interleave. Compare like with like; the shard-vs-shard comparison is the valid one.
- The suite has a known **local staleness hazard**: `npm test` without a prior
  `npm run build` fails 4 files against a stale `lib/dist` (observed 2026-10-05; already
  tracked as `bug-test-suite-lib-dist-rebuild-race`). CI builds first, so CI is unaffected.
  Any CI timing work must not "optimize" by removing the build step.

## Recommendation

**Sequence the work by measured return, and take the free structural wins first. Do not
tune Vitest.**

1. **Concurrency groups on the PR-triggered workflows** (A). One YAML stanza per workflow,
   zero risk to any gate, saves entire superseded runs on every push-during-a-run. Revertible
   by deleting the stanza. Do this first because it is independent of everything else.
2. **Duration-aware shard assignment** (C) with an **aggregator job named `cli`** that
   `needs:` the shard jobs (B, constrained as above). This is the largest single lever
   available, and free on a public repo. Gate it on one throwaway CI run that measures the
   real 4-core shard wall times, and pick the shard count from that — not from these local
   numbers.
3. **Then attack the floor: `worktree.test.ts`** (D). Until the 55–83 s file is cheaper or
   split, every shard topology floors at its duration and step 2's return is capped.
   `task-runcli-import-tsx-migration` already exists and is the natural home.
4. **Leave `auto-done`'s inline suite run** (G) alone for now, but record it: it is a
   documented ~250 s per merge that is _not_ on the PR critical path and does not gate
   anything a developer waits on.

**Rejected, with reasons:**

- **E (pool/isolation/cache tuning)** — the suite is 97 % `tests` by its own reported phase
  breakdown. This is the classic wrong first move, and the measurement says so up front.
- **F (merge queue)** — real savings, but it changes the release story's ordering
  dependencies (ADR 0018 C3, auto-done's re-checkout). A delivery-model decision, not a
  speed fix; it would need its own exploration and ADR.
- **Dropping or narrowing any gate to save time** — violates criterion 2. The smokes and
  structure gates are BLOCKING by explicit, documented design (`bug-worktree-link-farm-breaks-playwright-runner`
  and friends). Latency bought with a review bar is a regression.

Expected outcome: step 1 removes whole runs from the duplicate-push case; step 2 takes the
critical path from a single 252 s serial step to the slowest shard, whose floor is one test
file — a step change from "the whole suite is the critical path" to "one file is". Step 3
lowers that floor. The order matters: step 3 alone buys the least (it cannot shrink a
wall-clock number that is dominated by 4 cores' worth of everything else), and step 2 alone
is capped by the floor.

## Decision

Cross-cutting — it fixes the shape of the required check and couples CI topology to
auto-done's hand-posted `cli` check — so it lands in an ADR that links this exploration.
**ADR not yet written**; it is the next free number at the time of writing
(`../adr/0023-ci-wall-clock.md`). Until it lands, this exploration is the record of the
decision.

Follow-up work is filed as tracked items (see the report): measure the real 4-core shard
walls, the concurrency stanza, and the `worktree.test.ts` floor.
