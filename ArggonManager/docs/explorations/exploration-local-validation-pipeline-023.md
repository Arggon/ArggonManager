---
exploration_id: local-validation-pipeline-023
title: A fully local validation pipeline that does not depend on GitHub Actions
status: open
created: 2026-10-05
---

# Project exploration: A fully local validation pipeline that does not depend on GitHub Actions (local-validation-pipeline-023)

Greenfield record (the six-phase protocol, `skills/arggon-cli/references/exploration.md`
— ADR 0017). Thinking is the deliverable: nothing here is implemented.

**The short answer.** Every gate the required `cli` check runs already exists as a
single npm script — 9 of the job's 10 runnable steps are npm scripts (8 gates plus
`npm ci`, which is setup), and only the version guard is not — so a local pipeline is
**composition, not new machinery** — but
measurement shows a local run is _not_ equivalent to CI, in two specific and
different ways (a stale `lib/dist` produces a false red; one required gate silently
runs a weaker leg locally than in CI). So the decision is not "which runner" but
**"where the gate list lives, and what a local run is allowed to claim."**
Recommendation: **npm scripts own the gate list, the workflow calls them, and a
parity test holds the two together** — no new runtime dependency.

Classification: **greenfield**. Adjacent records:
[exploration-ci-pipeline-wall-clock-022](./exploration-ci-pipeline-wall-clock-022.md)
(wall clock) and [ADR 0023](../adr/0023-ci-wall-clock.md) (CI topology) — this one
answers a different question and must not re-open theirs.

## Classification

**Greenfield**: there is no local pipeline to read and extend, and what would be built
is an interface other work depends on.

- **No existing flow.** The repo has **no** task runner — no `Taskfile.yml`,
  `justfile`, `Makefile`, `mise.toml` or local orchestrator anywhere in the tree
  (checked 2026-10-05). What exists is (a) individual npm scripts and (b) the gate
  _ordering_, which lives only inside `.github/workflows/ci.yml`. The thing to be
  built is that missing composition layer.
- **Others will depend on it.** It would become the documented way to run the
  blocking end-to-end check (`ArggonManager/docs/engineering.md` §Review bar) for
  makers, the standards reviewer and the verifier, and — because it is a _template
  change_ — for every adopter on the next release.
- **The decision is cross-cutting**: it fixes where the gate list lives, which is the
  same "one rule, two spellings" class this repo already documents for the seam pin
  (`bug-ci-seam-pin-shell-vs-test-copy-divergence`) and for ADR 0023's required-check
  name.
- **Ratchet**: nothing found here downgrades it. The bounded-looking surface is the
  workflow file, but the workflow is an _input_, not the flow being extended — it is
  the second spelling that the decision has to eliminate.

## Ground (measured 2026-10-05, not assumed)

Machine: node **v26.7.0**, npm **12.0.2**, `opencode` **v2.0.23** on PATH, 12 cores.
Repo declares `engines.node >=22.12.0`; CI uses `node-version: 22`.

### The required `cli` job, gate by gate — local verdict

Every gate is a single npm script **except** the version guard, whose logic already
has its own local test (`cli/version-guard.test.ts`).

| Gate (`ci.yml`)                         | Local command                                                                                                   | Observed locally                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                | —                                                                                                               | not run: setup, not validation (`prepare` → `build`)                                                                                     |
| version guard (`if: pull_request` only) | `cli/version-guard.mjs` + `cli/version-guard.test.ts`                                                           | **no local counterpart by design** — needs a PR base SHA; logic is test-covered                                                          |
| build                                   | `npm run build`                                                                                                 | **PASS 24 s**; tree clean afterwards (committed plugin bundle in sync)                                                                   |
| plugin drift                            | `npm run check:plugin`                                                                                          | implied green (build produced no diff)                                                                                                   |
| test                                    | `npm run test`                                                                                                  | **1 failed / 2691 passed (90.2 s) _without_ a prior build**; `cli/src/headless-ci.test.ts` after `npm run build` → **7/7 pass (18.9 s)** |
| lint                                    | `npm run lint`                                                                                                  | PASS 10 s                                                                                                                                |
| structure gates                         | `npm run test:structure`, `npm run lint:structure`                                                              | PASS <1 s / 2 s                                                                                                                          |
| native-start smoke                      | `npm run smoke:native-start-cold`                                                                               | **FAIL 13 s** — see finding 2                                                                                                            |
| Playwright lane                         | `npm run smoke:worktree-playwright`                                                                             | PASS 3 s; offline, `--list` only, **no build needed**                                                                                    |
| `ui-smoke` job                          | `npx playwright install --with-deps chromium` + `npx playwright test --grep @smoke` + `npm run smoke:tui-board` | needs Chromium (privileged install) and a pty; **not a required check**                                                                  |

### The CI side, same day (run `37362522012`)

Step timeline from the Actions API: `npm ci` 22 s · version guard **0 s (skipped —
not a PR event)** · build 17 s · `check:plugin` 3 s · test **292 s** · lint 7 s ·
`test:structure` 0 s · `lint:structure` 1 s · native-start smoke **3 s** ·
Playwright lane 2 s.

## Frontier-rounds log

**Round 1 — outcome/users.** Who runs it, and what may they conclude? Makers and the
verifier need a verdict _before_ pushing; the product owner needs to know a green local
run is not a licence to skip CI. Settled: the pipeline's output is **evidence**, never
a gate substitute (see finding 1).

**Round 2 — scope.** Validation or delivery? Settled: **validation only.** `release.yml`
publishes through **OIDC trusted publishing** (`id-token: write`) plus the GitHub
Release API and a `git tag` push; `auto-done.yml` needs `contents`/`pull-requests`/
`checks: write`. None of that is reproducible from a laptop, and none of it is
validation. Explicit non-goal (edge table, authn/authz).

**Round 3 — constraints.** (a) npm is already required and already the only dependency
story the tarball has; (b) the repo _sells_ `.github/workflows/arggon.yml` to adopters,
so a pipeline that needs Docker, root, or a pinned binary the adopter must install
first is a bad product shape; (c) contributors are agent-operated on many machines;
(d) the review bar is BLOCKING by explicit design — a pipeline that _drops_ a gate is a
regression, not a saving (same bar ADR 0023 §Alternatives held).

**Round 4 — data.** Where does the gate list live? Today: partly in `package.json`
(what each gate is), partly in `ci.yml` (the order, the `if:` scoping, which lane is
required). That split is the defect, not the setup.

**Round 5 — interfaces.** If a pipeline exists, agents read its verdict. Per ADR 0006
the natural surface is a bounded `--json` envelope, not scraped stdout.

**Round 6 — failure/edge.** Ran the adversarial pass; results in the table below.

**Round 7 — rollout.** A `package.json` script change needs no release. Changing
`.github/workflows/ci.yml` does not either (it is this repo's own workflow, not the
vendored template). Changing `templates/docs/github/workflows/arggon.yml` **is** a
product change and reaches adopters only on the next release (ADR 0018) — which
decouples this work from the release train, because the recommendation keeps the
vendored `arggon.yml` recipe untouched.

## Edge cases

| Dimension                        | Hunted case                                                                                                                                                                                                                                                           | Resolution                                                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| input validation / hostile input | Gate list shell-interpolated, or a lane name taken from `npm run verify -- <lane>` unchecked; `GITHUB_*`/`RUNNER_*` present locally silently switching a gate to CI behaviour                                                                                         | **Spec criterion**: lanes are a closed, validated set; an unknown lane exits non-zero printing the known lanes; a local run must behave identically whether or not CI env vars are set |
| empty/loading/error states       | A pipeline that matches zero gates reports **green** — a false green, the worst failure mode a gate can have                                                                                                                                                          | **Spec criterion**: an empty or unrecognised gate set is an error, never success                                                                                                       |
| concurrency / idempotency        | Two agents in sibling worktrees run it at once: shared `$TMPDIR` (the age-gated 2 h purge in `test/teardown-tmp.ts`) and `smoke:worktree-playwright`, which creates a **real** git worktree plus a `smoke/wt-playwright-<pid>` branch in the repo's worktree registry | **Spec criterion**: concurrent-safe in sibling worktrees (pid-scoped fixtures and branches already are) or an explicit lock — stated either way, not assumed                           |
| failure/retry/timeout            | First non-zero exits, but the failure is only `npm ERR!`; no per-gate timeout, and the suite has 30 s+ single files (`prose-format` flake is already tracked)                                                                                                         | **Spec criterion**: name the failed gate, its exit code and its wall time; per-gate timeout policy specified                                                                           |
| authn/authz                      | Pipeline drifts into the publishing half, which needs OIDC tokens it can never have locally                                                                                                                                                                           | **Explicit non-goal**: the local pipeline never publishes, tags, or grants anything                                                                                                    |
| limits/quota/perf                | "Local is faster" becomes "local replaces the required check"                                                                                                                                                                                                         | **Non-goal + wording criterion**: docs state the required `cli` check keeps its authority; local gates are evidence (finding 1)                                                        |
| time/timezones/locale            | Timestamps in the verdict report compared across machines                                                                                                                                                                                                             | **Resolved — none plausible**: timings are human-facing only; no gate verdict is time-dependent                                                                                        |
| persistence/migration/rollback   | Stale `lib/dist`/`dist` is the pipeline's only persisted state, and it produces a **false red** (ground: 1 failed/2691 passed before build, 7/7 after)                                                                                                                | **Spec criterion**: `build` is a mandatory first lane, never an assumption                                                                                                             |
| observability/debuggability      | An agent has to scrape stdout to learn which gate failed                                                                                                                                                                                                              | **Spec criterion**: per-gate name, exit code, wall ms, plus a bounded `--json` envelope (ADR 0006)                                                                                     |
| security/threat model            | A local runner executes repo-controlled shell; and a "helpful" pipeline that runs `release.yml`/`auto-done.yml` bodies would attempt privileged acts                                                                                                                  | **Non-goal** (publish) + **spec criterion** (the pipeline enumerates gates explicitly; it never discovers and runs workflows)                                                          |
| environment/platform             | `smoke:tui-board` needs a pty; `npx playwright install --with-deps` needs root; `opencode` present changes a gate's strength (`engines` says node >=22.12.0, CI pins 22)                                                                                              | **Non-goal**: Windows parity for the `full` lane. **Spec criterion**: two declared profiles, and the resolved one is **printed** (finding 2)                                           |
| upgrade/data-loss                | Adding one devDependency to own the pipeline raises the **adopters'** Node floor                                                                                                                                                                                      | **Finding 3**: the deciding fact against the one-dependency candidate                                                                                                                  |

## Approaches considered

### Candidates

- **A. `act`** — run the real workflow YAML locally. **v0.2.89**, released 2026-06-01
  (source: <https://github.com/nektos/act/releases>, accessed 2026-10-05); still on a
  monthly release cadence, so it is not abandoned. It "uses the Docker API to either
  pull or build the necessary images, as defined in your workflow files" (source:
  <https://nektosact.com/>, accessed 2026-10-05).
- **B. A binary task runner as the definition owner** — go-task **v3.54.0**
  (2026-10-01, <https://github.com/go-task/task/releases/tag/v3.54.0>) or `just`
  **1.58.0** (2026-08-03, <https://github.com/casey/just/releases/tag/1.58.0>). Both
  mature, both single static binaries, both cross-platform.
- **C. npm scripts as the definition owner** — no new runtime dependency; `npm` is
  already required by every gate and already the install story the tarball ships.
- **D. Git-hook managers** — lefthook **v2.1.17** (2026-10-05,
  <https://github.com/evilmartians/lefthook/releases/tag/v2.1.17>) or husky **9.1.7**
  (<https://registry.npmjs.org/husky/latest>).
- **E. Dagger** — **v0.21.10**, 2026-09-30
  (<https://github.com/dagger/dagger/releases/tag/v0.21.10>); a real CI/CD engine that
  runs locally.
- **F. `mise` tasks** — **v2026.10.3** (2026-10-05, `jdx/mise`); already installed on
  this machine (v2026.10.0) but it is a _personal_ tool here, not a repo dependency.
- **G. One dependency that composes npm scripts** — npm-run-all2 **9.0.3**
  (<https://registry.npmjs.org/npm-run-all2/latest>).

### Criteria

1. **No new install burden** for contributors, agents or adopters. The vendored
   `arggon.yml` gate is the product; anything a user must install before they can
   validate is a product cost.
2. **One spelling of the gate list.** The repo has already been bitten by a rule with
   two implementations (`bug-ci-seam-pin-shell-vs-test-copy-divergence`) and solved it
   with a parity test. Same class, same discipline.
3. **Preserve the review bar.** Every BLOCKING gate stays; nothing is narrowed for
   speed or convenience (ADR 0023 §Alternatives).
4. **Honest claims.** A local run must not be able to look like the required check, and
   a weaker local configuration must not be able to look like the CI one (finding 2).
5. **Reversibility.** Each step of the rollout is one revert.
6. **Survives ADR 0023.** The topology there (duration-aware shards, an aggregator job
   named `cli`) must not have to be re-decided here.

### Findings

**1. A local run can never satisfy the required check — by design, not by omission.**
Required status checks "must have a `successful`, `skipped`, or `neutral` status
before collaborators can make changes to a protected branch", and because a required
check names the app that must set it, "if the status is set by any other person or
integration, merging won't be allowed" (source:
<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>,
accessed 2026-10-05). So a local pipeline is **evidence and ergonomics**, never a gate
substitute. This kills any design whose selling point is "CI you can skip", and it is
the honest ceiling on the whole feature.

**2. One required gate runs a _weaker_ leg in CI than on a developer's machine — and
the strong leg is red today.** `smoke:native-start-cold` probes `opencode --version`
and, when the binary is absent, reports `move leg skipped: the opencode binary is not
installed (CI)` and **counts it as `ok: true`**
(`smoke/native-start-cold-smoke.ts:2177-2191`). The CI job installs no `opencode`, and
the CI log for run `37362522012` contains exactly that line — so **CI runs the gate
without its strongest leg** (the real `opencode serve` + session move + scripted
provider leg). On this machine (`opencode` v2.0.23) that leg **runs and fails**:

```text
FAIL the scripted drive was exactly one execute round with the native comment script, then a closing text round
      the final text round preceded the tool round
```

The scripted provider _is_ model-free and offline (an in-process OpenAI-compatible SSE
server), so the "MODEL-FREE … needs no provider, no quota" comment in `ci.yml` is
accurate — but the same comment's evidence line, "Observed runtime ~0.5s (5/5 local
runs: 0.47-0.48s, 20/20 checks)", matches the **skipped-leg** configuration: the run
today took **13 s and failed**. Consequence: **the required `cli` gate and the gate a
developer runs are two different tests wearing one name**, and the stronger one is
currently red. A local pipeline is the only place the strong leg ever runs, which makes
"print the resolved profile" a requirement, not a nicety.

**3. The obvious "one dependency" candidate raises the adopters' Node floor.**
npm-run-all2@9.0.3 declares `engines.node` as `^22.22.2` or `^24.15.0` or `>=26.0.0`,
while this repo declares `>=22.12.0` (`package.json`) and CI pins `node-version: 22`.
Adding it to own the pipeline would either raise the floor every adopter inherits or
emit `EBADENGINE` on the supported-but-below range — for a script runner that does
what `&&` does.

**4. The gates are already one-to-one with scripts, so the real work is the ordering —
and the ordering is what CI's `build` protects.** Ground: of the 10 runnable steps in the
required `cli` job, **9 are npm scripts** (8 gates plus `npm ci`, which is setup); only
the PR-scoped version guard is not, and its logic is
already covered by `cli/version-guard.test.ts`. Conversely the _one_ thing CI does that
a naive local pipeline would not is `npm ci` → `prepare` → `build` **before** test. The
measured consequence of omitting it is a false red: `1 failed / 2691 passed`, with
`cli/src/headless-ci.test.ts` reporting that two fresh `init --json` checkouts disagree
— and 7/7 green after `npm run build`. That is the stale-`lib/dist` hazard
`bug-test-suite-lib-dist-rebuild-race` recorded (that race is now **done**; the
_ordering dependency_ it implies is written down nowhere a machine reads).

**5. Every local tool is available and none of them is free.** act v0.2.89, go-task
v3.54.0, just 1.58.0, lefthook v2.1.17, Dagger v0.21.10, mise v2026.10.3 — all current,
all maintained. The choice is therefore not about maintenance risk; it is about install
burden and about who owns the list.

**6. `act` cannot satisfy the brief even though it is the closest fit for "run CI
locally".** It executes the GitHub Actions workflow file, so a pipeline built on it
_depends on GitHub Actions by construction_ — the opposite of the stated goal — and it
adds a Docker daemon (or a community runner image) to a validation loop that currently
needs only Node. It also cannot help the only gate whose behaviour actually diverges
(finding 2): the divergence is "is `opencode` installed", not "is the YAML the same".

### Recommendation

**C — npm scripts own the gate list; the workflow calls them; a parity test holds the
two together; zero new runtime dependency.**

Concretely: one `verify` script whose ordered lanes are exactly the required `cli`
job's gates (starting with `build`, per finding 4), named lane scripts for partial
runs, a printed and `--json`-reportable verdict (finding 2's profile + per-gate exit
code and wall time). `.github/workflows/ci.yml` keeps its steps but each `run:` becomes
`npm run <lane>`, so the **order and membership live in one place**; a test asserts the
workflow invokes only known lanes and in the same order — the same
"one rule, held by a parity test" shape already used for `arggon.yml`
(`cli/src/headless-ci.test.ts`) and for the seam pin (`cli/src/ci-seam-pin.test.ts`).
The shipped `arggon.yml` template stays untouched, so adopters inherit nothing they
must install and the release train is not coupled.

**Why the others lose:**

- **A (`act`)** — depends on GitHub Actions by construction, needs Docker, cannot fix
  the one gate that actually diverges, and asks adopters to install a daemon before
  they may validate. Rejected.
- **B (go-task / just as definition owner)** — genuinely good tools, but it makes a new
  binary a precondition for validating a repo and for every adopter's first gate; it
  also hands the definition to a file outside `package.json`, so `npm test` and
  `task test` become two entry points again. Rejected **as the definition owner**;
  acceptable later as an optional local convenience wrapper that calls the same npm
  scripts — which is the whole point of C.
- **D (lefthook / husky)** — a hook is a _trigger_, not a definition; a pre-commit
  running the full suite would be the wrong shape (the review bar wants the full run at
  review time, not on every commit). The existing `pre-commit` gate
  (`npm run arggon -- validate`) stays as-is.
- **E (Dagger)** — an engine and a container runtime to compose nine npm scripts. YAGNI.
- **F (mise tasks)** — already on this machine but a personal tool; a repo `mise.toml`
  would be a new project convention adopters must adopt. Same install-burden rejection
  as B, with less ecosystem reach for a repo this size.
- **G (npm-run-all2)** — rejected on finding 3 (raises the shipped Node floor) for a
  capability `&&` already provides.

**Trade-offs of C, stated plainly.** (a) npm scripts have no dependency graph, no lane
selectors and no parallelism, so partial and parallel runs are clumsier than a task
runner's — mitigated by named lanes, and accepted because nothing here needs a graph.
(b) npm's error surface is poor, so the pipeline owes a small reporting step to name
the failing gate; that is a real cost of C, not a free win. (c) The parity test is a
second place to update when a gate is added — the same tax ADR 0023 already accepted
for the required-check name, and the reason the test must _execute_ the comparison
rather than remember it. (d) A local run still cannot prove the CI-only steps
(the PR-scoped version guard, the pinned-lag assertion, publishing), so the verdict
must say which gates it covered.

**Sequenced, each step independently revertible:** (1) land the gate-list spec and the
parity test _first_, red against today's `ci.yml`; (2) add the npm `verify` lanes;
(3) reduce the workflow steps to `npm run <lane>`; (4) document the profile and the
CI-only gates. Step 3 is the only one that changes CI behaviour, and it changes nothing
about _what_ runs.

### What this does not decide

ADR 0023's sharding, the `cli` aggregator's name and auto-done's hand-posted check are
untouched here; this design must merely keep working when they land. The **red**
`smoke:native-start-cold` MOVE leg is a defect in its own right and is filed as a bug,
not absorbed into this decision.

## Decision

Cross-cutting — it fixes where the gate list lives and couples the local verdict to the
required check — so it lands in an ADR that links this exploration:
**`../adr/0024-local-validation-pipeline.md`**, not yet written (next free number at
the time of writing). Deciders: the product owner (human) and the Arggon delivery lead,
matching ADR 0023's shape. **Until it lands, this exploration is the record of the
decision.**

Artifact order (ADR 0017 gate): this doc → ADR 0024 → the spec, with the hunted cases
above as its acceptance criteria → plan + tasks. **No implementation task may be claimed
before that spec exists and `arggon spec analyze` reports no NEW findings.**

## Follow-up work

Filed as tracked items (see the delivery report): the ADR, the spec, and the
`smoke:native-start-cold` gate-fidelity bug. A measured trigger for the existing
`bug-headless-ci-twin-init-nondeterministic` was added as a comment on that item rather
than filed twice.
