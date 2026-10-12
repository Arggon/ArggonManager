---
type: bug
status: in_progress
id: bug-release-lockfile-sync-step-cannot-run
title: "release-please.yml's lockfile-sync step fails: `npm install --package-lock-only` runs the root `prepare` -> `npm run build` -> TS2591 on the runner (no node_modules) - the run is red and the #1993 lockfile reconciliation never happens"
assignee: arggon-delivery-lead
branch: fix/bug-release-lockfile-sync-step-cannot-run
parent: story-release-pipeline
labels: [release, ci, failure-mode, gate-fidelity]
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T17:27:25.869Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-release-lockfile-sync-step-cannot-run
---

<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-lockfile-sync-step-cannot-run.md
  Leaves live only under a story. id is the filename stem: bug-release-lockfile-sync-step-cannot-run.
  CLI `arggon create bug release-lockfile-sync-step-cannot-run` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# release-please.yml's lockfile-sync step fails: `npm install --package-lock-only` runs the root `prepare` -> `npm run build` -> TS2591 on the runner (no node_modules) - the run is red and the #1993 lockfile reconciliation never happens

## Context

Found 2026-10-12 by the delivery lead during wave-3 merge verification, in the
first healthy `release-please.yml` run after the `autorelease` deadlock was
cleared (`bug-autorelease-label-lifecycle-unowned` context comment):

- Run **38283343454** (push `aeb7b7b`, merge-verification tracker push): the
  abort backstop printed `release-abort-check: OK` and release-please opened
  release PR **#744** (`chore: release main`) — the pipeline is alive — but the
  run concluded **failure** in the `Sync package-lock.json onto the release PR
branch` step.
- Verbatim cause: `npm install --package-lock-only` executes the root
  `prepare` script (`npm run build` — see root `package.json` `"prepare"`), and
  the lib build fails on the runner with
  `src/atomic.ts(1,29): error TS2591: Cannot find name 'node:crypto'` and every
  sibling `node:*`/`process`/`Buffer`/`NodeJS` error — `@types/node` is not
  resolvable because this workflow has no install (no `setup-node` cache, no
  `node_modules`) and `--package-lock-only` does not populate one. Exit 2,
  `##[error]Process completed with exit code 2`.
- **The lockfile is genuinely stale, not just the run red.** On `origin/main`
  as of `43d19f46`: `package-lock.json` records
  `packages[""].dependencies["@arggondev/lib"] = "^0.4.0"` and
  `packages["lib"].version = "0.4.0"`, while `package.json` pins `^0.6.0` and
  `lib/package.json` is `0.6.0`. Release PR #744 only carries release-please's
  own version-field updates (`0.6.0` → `0.7.0`, 4 lines); the dependency
  spec/workspace version the sync step exists to reconcile are untouched.
- **Establish WHY, honestly, as part of the fix** — the candidate explanations
  do not have equal evidence: (a) a runner npm/Node change on `ubuntu-latest`
  started executing `prepare` under `--package-lock-only`; (b) the failure is
  latent since the step landed and only visible now that a release PR is open
  again (the step no-ops with "no open release PR" during the deadlock window,
  and `#664` was open 2026-10-02→09). Check the sync step's outcome in the
  `#664`-era runs before deciding. Do not guess in the item; record the runs
  inspected.
- Impact: the run is red; the documented #1993 reconciliation (release PR
  lockfile vs bumped package.json) never runs; the merged-lockfile staleness on
  main persists. Empirically `npm ci` on main is green despite the stale ranges
  (workspace `link: true` resolution) — do not claim a stronger impact than the
  runs show.

## Acceptance

- [x] The fix makes the step's install run without lifecycle scripts (e.g.
      `npm install --package-lock-only --ignore-scripts`) or an equivalent that
      still resolves the lockfile fully — state the choice and why it cannot
      skip a resolution the step needs
- [x] Recorded root cause with evidence: which runs were inspected (`#664`-era
      sync-step outcomes vs run 38283343454) and whether this is a runner
      environment change or was latent — no guess
- [ ] Verified on a real `release-please.yml` run after the fix lands: the sync
      step completes, pushes the reconciled `package-lock.json` onto the open
      release PR (expect the `@arggondev/lib` spec + workspace version to match
      the PR's `package.json`), and the run is green — expected vs observed
- [x] Negative case preserved: if the lockfile cannot be produced the step still
      fails loudly (it must never silently pass with a desynced lockfile)
- [x] `npm ci` on the release PR branch after the sync is green (the #1993
      symptom the step exists to prevent), or a recorded reason why it cannot be
      run
- [x] `npx actionlint` clean on the changed workflow; `arggon validate` green

## Notes

### Root cause: latent since the step landed — not a runner change (box 2)

**Failure inventory** — every run of this workflow fetched through the API
(`actions/workflows/release-please.yml/runs`, 2026-10-01 → 10-12: 377 runs, 62
failures), each failing run's step read from `runs/<id>/jobs`:

| window                           | release PR                                                                          | runs failing in this step                                                                                      | cause                                         |
| -------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 2026-10-01T18:36Z → 10-02T05:39Z | #556 (created 2026-10-01T18:39:09Z by run 36908073600, merged 2026-10-02T12:16:48Z) | **39** (26 on 10-01, 13 on 10-02 before the merge)                                                             | TS2591, identical `prepare` → `build` failure |
| 2026-10-07T16:01Z → 10-09T14:45Z | #664 (created 2026-10-07T16:04:23Z by run 37648763109, merged 2026-10-09T15:14:36Z) | **8** (37648763109, 37651478610, 37660850172, 37662722859, 37663812581, 37934103136, 37943907204, 37946621948) | TS2591                                        |
| 2026-10-12T17:18Z → 17:27Z       | #744 (created 2026-10-12T17:21:12Z by run 38283343454)                              | **2** (38283343454, 38284301238)                                                                               | TS2591                                        |
| **total**                        |                                                                                     | **49**                                                                                                         |                                               |

The other 13 workflow failures in the window are not this defect:
release-please-action failures (10, one on the old tag-pinned `@v4`), the
`Surface an aborted release` step (1), and two with no failing step recorded.
The first success after #556's merge is the no-op at 2026-10-02T12:16:50Z
(37005746756); the PR-less stretch then runs until #664's creation on 10-07.

Runs read individually (log per run; failing-step name from
`gh run view <id> --json jobs`):

| run             | created              | sync-step outcome                                                                                                                                                                                                                                                                | run                     |
| --------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **36908073600** | **2026-10-01T18:36** | **first exposure — the workflow's first run**: the release-please step of this same run creates PR #556 at 18:39:09Z, so the sync step finds `release-please--branches--main`, checks it out, and dies in `> arggon-manager@0.5.0 prepare` → `src/atomic.ts(1,29): error TS2591` | **failure** (sync step) |
| 37005746756     | 2026-10-02T12:16     | `no open release PR - nothing to sync` (first run after #556's merge)                                                                                                                                                                                                            | success                 |
| 37065003701     | 2026-10-02T21:08     | `no open release PR - nothing to sync` (no-op, ~9 h after the merge; earliest no-op inspected)                                                                                                                                                                                   | success                 |
| 37641543969     | 2026-10-07T15:03     | `no open release PR - nothing to sync` (no-op)                                                                                                                                                                                                                                   | success                 |
| 37645808234     | 2026-10-07T15:42     | `no open release PR` (no-op)                                                                                                                                                                                                                                                     | success                 |
| 37646194763     | 2026-10-07T15:45     | `no open release PR` (no-op)                                                                                                                                                                                                                                                     | success                 |
| 37647730584     | 2026-10-07T15:56     | `no open release PR` (no-op)                                                                                                                                                                                                                                                     | success                 |
| **37648763109** | **2026-10-07T16:04** | **the #664 window's first failure**: this run's release-please step creates PR #664 at 16:04:23, and the sync step dies in `> arggon-manager@0.6.0 prepare` → `npm error workspace @arggondev/lib@0.6.0` → `npm error code 2`                                                    | **failure** (sync step) |
| 37651478610     | 2026-10-07T16:22     | same failure on `arggon-manager@0.6.0`                                                                                                                                                                                                                                           | failure (sync step)     |
| 37660850172     | 2026-10-07T17:40     | same failure                                                                                                                                                                                                                                                                     | failure (sync step)     |
| 37662722859     | 2026-10-07T17:54     | same failure                                                                                                                                                                                                                                                                     | failure (sync step)     |
| 37663812581     | 2026-10-07T18:03     | same failure                                                                                                                                                                                                                                                                     | failure (sync step)     |
| 37934103136     | 2026-10-09T13:02     | same failure                                                                                                                                                                                                                                                                     | failure (sync step)     |
| 37943907204     | 2026-10-09T14:24     | same failure                                                                                                                                                                                                                                                                     | failure (sync step)     |
| 37946621948     | 2026-10-09T14:45     | same failure                                                                                                                                                                                                                                                                     | failure (sync step)     |
| 37950252277     | 2026-10-09T15:14     | `chore: release main (#664)` push — #664 already merged, no open PR → no-op                                                                                                                                                                                                      | success                 |
| 38283343454     | 2026-10-12T17:18     | same failure on `arggon-manager@0.7.0` (TS2591), opens PR #744                                                                                                                                                                                                                   | failure (sync step)     |
| 38284301238     | 2026-10-12T17:27     | same failure on `arggon-manager@0.7.0` (TS2591)                                                                                                                                                                                                                                  | failure (sync step)     |

Decisive facts:

- The step **never once completed its install path on the runner**: **49 runs
  across three release-PR windows** failed in exactly this step (#556 window 39,
  #664 window 8, #744 window 2), and no run exists in which
  `npm install --package-lock-only` succeeded. Every success outside those
  windows is the `no open release PR` early exit.
- **Latent, not a runner change** — and more strongly supported than the first
  revision of these Notes claimed: the identical failure already occurred on
  **2026-10-01, in the workflow's first run (36908073600)**, 11 days before
  38283343454, and the runner images are equivalent where it matters:
  `ubuntu-24.04` build `20260927.320` (10-01 and 10-07) and build `20261004.327`
  (10-12) all ship Node.js 22.23.3 / npm 10.9.9. The step landed 2026-10-01
  (7230609f) with the root `prepare` → `npm run build` script in place since
  2026-09-19 (b300eb96) — the first release PR appeared ~1.5 h later.
- The no-op hides it only _between_ windows: the step exits before the install
  whenever `gh pr list --state open --head release-please--branches--main` is
  empty, and no release PR was open from #556's merge (2026-10-02T12:16:48Z)
  until #664's creation (2026-10-07T16:04:23Z) — the pipeline deadlock window.
  Correction to this item's Context: the release PR open on 10-02 was **#556**,
  not #664. #556 was created 2026-10-01T18:39:09Z by run 36908073600 and merged
  10-02; #664 was created 2026-10-07T16:04:23Z by run 37648763109 and merged
  10-09. The first live release PR and the first exposure of the defect are the
  same event — on **#556 / run 36908073600**, not #664.
- Provenance of this correction, for the record: an earlier revision of these
  Notes named 37648763109 (10-07) as the first exposure and counted 9 failures —
  an artifact of a `--limit`-truncated `gh run list`. It was caught in review
  (verdict commit 2f2ab18a) and the inventory above was re-derived by
  enumerating **all 377 runs** through the API and reading every failure's
  step.
- Mechanism: `npm install --package-lock-only` still runs the root `prepare`
  even though it installs nothing, so `npm run build` executes in a checkout
  with no `node_modules`; on the runner a `tsc` is on `PATH` (the image's
  `toolset-2404.json` declares `typescript` → `tsc` under `/node_modules/`), so
  the build gets as far as type-checking and dies with TS2591 on
  `node:*`/`process`/`Buffer`/`NodeJS`; locally no global `tsc` exists, so the
  same lifecycle invocation dies earlier with `sh: tsc: command not found`
  (exit 127). Same root cause either way.

### Fix (box 1): `--ignore-scripts` on the sync install

`npm install --package-lock-only --ignore-scripts` (one line in the sync step,
plus a comment carrying the why). The step's whole job is _resolution_, not
installation — its own comment already says "no install" — therefore its
lifecycle scripts are not part of what it needs. `--ignore-scripts` suppresses
`preinstall`/`install`/`postinstall`/`prepare` and friends and leaves dependency
resolution untouched; the tree has no `git` dependency whose build a lockfile
would need (checked: `jq '[.packages[] | select(.resolved? and
(.resolved|startswith("git")))] | length'` on the produced lockfile → `0`), and
workspace resolution is a local `link` path, not a script.

Flag-independence is proven, not asserted: in a scratch worktree of
`origin/release-please--branches--main` (`git worktree add
/tmp/opencode/rel-sync-repro origin/release-please--branches--main`, no
`node_modules`), the lockfile produced by `npm install --package-lock-only` is
**byte-identical** to the one produced by the same command plus
`--ignore-scripts`: same sha256
`e17c67460ac43bbcf96dcbce3a9e015677e38db77604392734c70559d7a8d328` with the
runner's npm (`npx -y npm@10.9.9`) — the unfixed run writes that lockfile before
its exit-127/TS2591 failure, and both variants write the same bytes. The flag
therefore cannot skip a resolution the step needs; it only stops the install
from trying to build the project.

### Reproduction and before/after (box 1)

Toolchains: local Node v26.7.0 / npm 12.0.2; runner image ships Node 22.23.3 /
npm 10.9.9, so all runner-faithful runs below use `npx -y npm@10.9.9`.

Before (failing):

```
$ npm install --package-lock-only          # local npm 12.0.2
npm notice run arggon-manager@0.7.0 prepare
> arggon-manager@0.7.0 build
> npm run build --workspace @arggondev/lib && tsc -p tsconfig.json && ...
sh: line 1: tsc: command not found
npm error Lifecycle script `build` failed with error:  (code 127)
$ npx -y npm@10.9.9 install --package-lock-only   # runner npm
... same lifecycle failure, exit 127   # on the runner: TS2591, exit 2
```

After (fixed), on the release PR branch:

```
$ npm install --package-lock-only --ignore-scripts   # npm 12.0.2 → exit 0
$ npx -y npm@10.9.9 install --package-lock-only --ignore-scripts → exit 0
```

`package-lock.json` as committed on the branch vs produced by the fixed command
(`jq`, matching the acceptance criterion):

| field                                         | as committed on the PR branch                                  | after the fixed sync           |
| --------------------------------------------- | -------------------------------------------------------------- | ------------------------------ |
| `packages[""].dependencies["@arggondev/lib"]` | `"^0.4.0"` (branch `package.json` says `"^0.7.0"`)             | `"^0.7.0"`                     |
| `packages["lib"].name` / `.version`           | `"@arggondev/lib"` / `"0.4.0"` (`lib/package.json` is `0.7.0`) | `"@arggondev/lib"` / `"0.7.0"` |
| lockfileVersion                               | 3                                                              | 3                              |

Both target fields now match the branch's `package.json` and `lib/package.json`.
The reconciled delta on the runner's npm is those 2 lines
(`^0.4.0`→`^0.7.0`, `0.4.0`→`0.7.0`) plus 12 `"libc"` field removals from
optional platform packages (npm-major formatting — see the note below): with
`libc` stripped, the before/after lockfiles differ in nothing else. No
`node_modules` is created, so the step's "no install" property is intact.

### Negative case preserved (box 4)

No `|| true`, no `continue-on-error`, no swallow — the fix is the flag only, so
`set -euo pipefail` still fails the step on any non-zero npm exit. Verified with
a real negative control in the scratch: with `commander` pinned to an
unsatisfiable `^99.0.0`, `npm install --package-lock-only --ignore-scripts`
exits **1** (`npm error code ETARGET` / `no matching version found for
commander@^99.0.0`) and does **not** touch `package-lock.json`. Two properties
keep the fail-loud path honest:

- npm exits non-zero when it cannot produce the lockfile, and because the step
  runs under `set -euo pipefail` the job goes red before the `git diff`/commit/
  push block — the PR is never updated with a lockfile whose install was never
  proven.
- The `git diff --quiet` check only short-circuits when the lockfile is already
  in sync, i.e. after a successful install; it is not an error path. (Note for
  the record: npm rewrites `package-lock.json` _before_ a lifecycle script fails,
  so a hypothetical `|| true` here would silently commit a partially reconciled
  lockfile — which is exactly why the step must stay fail-loud.)

### `npm ci` on the release PR branch (box 5)

Scratch worktree at `origin/release-please--branches--main` (HEAD `9ffe998f`),
lockfile = the fixed command's output, runner's npm:

```
$ npx -y npm@10.9.9 ci
> arggon-manager@0.7.0 prepare → build → @arggondev/lib@0.7.0 build → postbuild
added 160 packages, and audited 162 packages in 14s
npm ci EXIT: 0
```

`npm ci` is green after the sync, with the full lifecycle chain running for real
this time. Honest scope: `npm ci` is **also** green on the branch with the stale
committed lockfile (`added 158 packages`, exit 0) — workspace `link: true`
resolution absorbs the `^0.4.0` vs `^0.7.0` mismatch, as the Context already
noted. The observable this fix restores is therefore the reconciled lockfile
content plus the green run, not a red `npm ci` on the PR; no stronger claim is
made.

### Gates (box 6) — expected vs observed

| gate                                              | expected       | observed                                                                                                                        |
| ------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run arggon -- validate`                      | ok, 0 warnings | `arggon validate: ok (0 warning(s), convention v5)`, exit 0                                                                     |
| `actionlint .github/workflows/release-please.yml` | clean          | `actionlint v1.7.12`, exit 0, no findings (control: `release.yml` also exit 0)                                                  |
| `npx prettier --check` on changed files           | clean          | workflow clean; item file conformant after `prettier --write` (pre-existing frontmatter blank-line issue in the committed file) |
| `npm run test:structure`                          | green          | `5 passed; 0 failed`                                                                                                            |
| `npm run lint:structure`                          | no findings    | exit 0, no findings                                                                                                             |

Note: `npx actionlint` does not resolve in this environment (actionlint ships as
a Go binary, version-pinned at v1.7.12 on `PATH`, which is how the repo's other
items ran it); the real binary was run and is clean.

### Observations outside this item's scope (report only, no files changed)

- The runner's npm 10.9.9 writes lockfiles **without** the optional-package
  `"libc"` fields that the repo's local npm 12 writes, so the next real sync will
  rewrite those lines too (same 216 packages, identical `@arggondev/lib` spec and
  workspace version; formatting-only churn). Whether to pin the step's Node/npm
  is a separate decision.
- Run 38282448930 (2026-10-12T17:10, merge of #740) failed in `Surface an
aborted release`, not in the sync step (the sync step was skipped) — that is
  `bug-autorelease-label-lifecycle-unowned` territory.
- Both runs carry the runner annotation "Node.js 20 is deprecated … forced to run
  on Node.js 24" for the two SHA-pinned actions (release-please-action,
  actions/checkout) — pre-existing, unrelated to this fix.

### Handoff

- Branch: `fix/bug-release-lockfile-sync-step-cannot-run` (worktree
  `/home/arggon/Projects/ArggonManager-bug-release-lockfile-sync-step-cannot-run`).
- Next concrete step (delivery lead, post-merge): watch the next
  `release-please.yml` run with PR #744 still open — the sync step must complete,
  commit and push the reconciled `package-lock.json` onto
  `release-please--branches--main` (expect `^0.7.0` in
  `packages[""].dependencies["@arggondev/lib"]` and `0.7.0` in
  `packages["lib"].version`), and the run must be green. Then tick the remaining
  acceptance box (real-run verification).
- Open questions: none blocking. Only the npm-major `libc` churn noted above,
  and the choice of whether the step should pin its npm (deliberately not done
  here — the diff stays the sync step).

### handoff 2026-10-12 @ses_eced77ddeffe7RDZa3wt3P1UKS (session: ses_eced77ddeffe7RDZa3wt3P1UKS) — next: Post-merge: watch the next release-please.yml run with PR #744 open; the sync step must complete and push the reconciled lockfile (^0.7.0 / 0.7.0), the run green, then tick the last acceptance box.

- branch: fix/bug-release-lockfile-sync-step-cannot-run
- open questions: Next sync also strips npm-10 libc fields (formatting only); whether to pin the step's npm left open; run 38282448930's abort-step failure is sibling scope, reported not filed.

### 2026-10-12 @ses_eced77ddeffe7RDZa3wt3P1UKS

### Maker evidence

Branch `fix/bug-release-lockfile-sync-step-cannot-run`, PR #745 (not merged). Fix: the sync step now runs `npm install --package-lock-only --ignore-scripts` with a comment carrying the why. Full evidence, including the inspected-runs table, lives in **Notes** on this branch.

**Root cause — latent, not a runner change.** All 9 runs that had an open release PR failed in exactly this step; the first was **37648763109** (2026-10-07T16:04, the same run that created PR #664) — 5 days before 38283343454, on equivalent images (ubuntu-24.04 `20260927.320` vs `20261004.327`, both Node.js 22.23.3 / npm 10.9.9). Every run outside that window took the `no open release PR` early exit (earliest inspected: 37065003701, 2026-10-02T21:08). Correction: #664 was created 2026-10-07T16:04:23Z, not open from 10-02.

**Reproduction** (scratch worktree of `origin/release-please--branches--main`, no `node_modules`):

- `npm install --package-lock-only` → exit 127 locally (`tsc: command not found`) / exit 2 with TS2591 on the runner.
- the same command + `--ignore-scripts` → exit 0, and the produced lockfile is **byte-identical** with and without the flag (sha256 `e17c67460ac43bbcf96dcbce3a9e015677e38db77604392734c70559d7a8d328`, runner npm 10.9.9) — resolution is unchanged.
- `jq` before/after: `packages[""].dependencies["@arggondev/lib"]` `^0.4.0` → `^0.7.0`; `packages["lib"].version` `0.4.0` → `0.7.0`.
- **Negative control**: an unsatisfiable registry dep makes the fixed command exit 1 (`ETARGET`) and leaves `package-lock.json` untouched; no `|| true` was added — the step stays fail-loud under `set -euo pipefail`.
- `npm ci` on the reconciled branch (runner npm): exit 0, `added 160 packages`, full prepare→build→postbuild. Honest scope: it is also exit 0 with the stale lockfile (workspace `link: true` resolution), so the restored observable is the reconciled lockfile plus the green run.

**Gates (expected vs observed):** `arggon validate` ok, 0 warnings · `actionlint v1.7.12` exit 0, no findings (`npx actionlint` does not resolve — actionlint ships as a Go binary on PATH) · `prettier --check` clean on both changed files · `test:structure` 5 passed / 0 failed · `lint:structure` exit 0.

Left unticked as instructed: _Verified on a real release-please.yml run after the fix lands_ (delivery lead, post-merge).

**Out of scope, reported not filed:** run 38282448930 failed in `Surface an aborted release` (sibling `bug-autorelease-label-lifecycle-unowned` territory); both runs annotate Node.js 20-deprecated actions forced onto Node.js 24.

### 2026-10-12 @ses_ecebd76f6ffeRyFG8k67Do7tZN

### verdict: request-changes (first-failure provenance is wrong: 2026-10-01 / run 36908073600 / PR #556, not 2026-10-07 / 37648763109 / #664)

Practice & standards review, read-and-reason only: no gates executed here. Inspected: PR #745 diff (gh pr diff), the workflow on main vs branch, the workflow's run history and step logs (gh run view --log), PR metadata (#556/#664/#744), and the git refs below.

**Verified by reading**

- Diff is exactly two files: `.github/workflows/release-please.yml` (+13 comment lines; the one line changed to `npm install --package-lock-only --ignore-scripts`) and this item file. No other step semantics changed; no `|| true`, no `continue-on-error`; `set -euo pipefail` and the `git diff --quiet` short-circuit are intact -> the negative case is preserved as claimed.
- Staleness / reconciliation claims hold: on `origin/release-please--branches--main`, `packages[""].dependencies["@arggondev/lib"]` = `^0.4.0` and `packages["lib"].version` = `0.4.0`, while that branch's `package.json` is `^0.7.0` and `lib/package.json` is 0.7.0 (main: `^0.6.0` / 0.6.0 / lockfile `^0.4.0`/0.4.0). `node_modules/@arggondev/lib` is `{resolved:"lib", link:true}`, so the item's honest-scope note on `npm ci` (green both with stale and reconciled lockfile) is coherent. No `chore: sync package-lock.json ...` commit ever landed on the release branch - the reconciliation indeed never happened.
- Root `prepare` is `npm run build`; the step landed 2026-10-01 (7230609f); PR #745 CI is green (cli / tasks-validate / ui-smoke, run 38285884615).

**Blocking finding - the item's and the shipped comment's "first failure" is wrong, and the failure inventory is incomplete**

`gh run view 36908073600 --log` shows the _first_ non-no-op run - created **2026-10-01T18:36Z**, the same run whose release-please step created release PR **#556 at 18:39:09Z**, ~1.5 h after the step landed - dying with the identical `src/atomic.ts(1,29): error TS2591` under `> arggon-manager@0.5.0 prepare` -> `npm run build`. Scanning every run of this workflow (2026-10-01..10-12) gives sync-step failures of **49, not 9**:

| window                       | release PR                                             | sync-step failures           | cause                               |
| ---------------------------- | ------------------------------------------------------ | ---------------------------- | ----------------------------------- |
| 10-01T18:36Z -> 10-02T05:39Z | #556 (created 10-01T18:39:09Z, merged 10-02T12:16:48Z) | 39                           | TS2591 (same prepare/build failure) |
| 10-07T16:01Z -> 10-09T14:45Z | #664                                                   | 8                            | TS2591                              |
| 10-12T17:18Z -> 17:27Z       | #744                                                   | 2 (38283343454, 38284301238) | TS2591                              |

Every success outside these windows is the `no open release PR` no-op (first after #556's merge: 37005746756, echoed at 12:19Z). "The step never once completed its install path" is therefore true - but the record pinning _which_ runs must be corrected:

- Item: "all 9 runs that had an open release PR failed in exactly this step" -> **49 runs across three release-PR windows**.
- Item: "the first was 37648763109 (2026-10-07T16:04 ...)" -> first is **36908073600, 2026-10-01, PR #556**; #664 is the _second_ exposure.
- Item: "the failure predates 38283343454 by 5 days" -> **11 days**.
- Item: "The first live release PR and the first exposure of the defect are the same event" -> true of **#556 (10-01)**, not #664.
- Item: "earliest inspected: 37065003701, 2026-10-02T21:08" -> the PR-less window begins at **2026-10-02T12:16:48Z** (#556's merge).
- Shipped workflow comment: "from the first non-no-op run (37648763109, 2026-10-07, PR #664)" -> wrong first; this line ships permanently.

The maker's correction to the Context is accurate for #664 (verified: created 2026-10-07T16:04:23Z, merged 2026-10-09T15:14:36Z) but incomplete - it replaces one wrong "first" with another and never names #556, the release PR that was open on 10-02.

**Not in question:** the conclusion (latent since the step landed, not a runner change) is confirmed and _better_ supported than written - the same failure on image builds ubuntu24/20260927.320 and ubuntu24/20261004.327. The flag choice and the fail-loud property are sound; the fix line itself needs no change.

**Requested change (tight scope)**

1. Workflow comment: first non-no-op run is **36908073600 (2026-10-01, PR #556)**, not 37648763109 (10-07, #664).
2. Item Notes / Decisive facts: add the #556 window (39 failures) to the inspected-runs table; correct 9 -> 49 and 5 days -> 11 days; name #556 in the correction and date the PR-less window from its merge (10-02T12:16:48Z).
3. Re-tick acceptance box 2 once the record is corrected; the fix itself is unchanged.

Not independently reproduced by me (execution evidence is the verifier's): the sha256 byte-identity with `npm@10.9.9`, the ETARGET negative control, `npm ci` exit codes, and the actionlint/prettier/test:structure/lint:structure gates - all maker-recorded in the item; this does not change the verdict above.

Out of scope, report only: run 38282448930's `Surface an aborted release` failure (sibling bug), the Node-20-deprecation annotations, npm-10 `libc` formatting churn.

### 2026-10-12 @ses_eced77ddeffe7RDZa3wt3P1UKS

### Correction — first-failure provenance (addresses verdict 2f2ab18a)

My earlier evidence comment above named run **37648763109 (2026-10-07, PR #664)** as the first exposure and counted **9** sync-step failures. Both numbers were artifacts of a `--limit`-truncated `gh run list` and are wrong. Corrected in commit `3d2d64b1` (workflow comment + Notes), with the fix line untouched.

Re-derived by enumerating **all 377 runs** of this workflow through the API (`actions/workflows/release-please.yml/runs`, 2026-10-01 → 10-12; 62 failures) and reading every failure's step from `runs/<id>/jobs`:

| window                           | release PR                                                                          | sync-step failures               |
| -------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| 2026-10-01T18:36Z → 10-02T05:39Z | #556 (created 2026-10-01T18:39:09Z by run 36908073600, merged 2026-10-02T12:16:48Z) | **39**                           |
| 2026-10-07T16:01Z → 10-09T14:45Z | #664 (created 2026-10-07T16:04:23Z, merged 2026-10-09T15:14:36Z)                    | **8**                            |
| 2026-10-12T17:18Z → 17:27Z       | #744 (created 2026-10-12T17:21:12Z)                                                 | **2** (38283343454, 38284301238) |
| **total**                        |                                                                                     | **49**                           |

- **First exposure: run 36908073600, 2026-10-01T18:36Z** — the workflow's first run, which created PR #556 at 18:39:09Z, ~1.5 h after the step landed. Its log shows `> arggon-manager@0.5.0 prepare` → `npm run build` → `src/atomic.ts(1,29): error TS2591`. So the first live release PR and the first exposure are the same event — on #556, not #664.
- The **latent-not-environment** conclusion is unchanged and better supported: 11 days of failure across image builds `ubuntu24/20260927.320` (10-01 and 10-07) and `ubuntu24/20261004.327` (10-12), all Node.js 22.23.3 / npm 10.9.9.
- The PR-less stretch runs from **#556's merge (2026-10-02T12:16:48Z)** to #664's creation (10-07T16:04:23Z); the first no-op after the merge is 37005746756 (12:16:50Z run, green).
- The other 13 workflow failures in the window are not this defect: release-please-action (10, one on the tag-pinned `@v4`), the abort step (1), two with no failing step recorded.

Gates re-run after the correction: `arggon validate` ok (0 warnings) · `actionlint` exit 0 · `prettier --check` clean on both changed files · `test:structure` 5/5 · `lint:structure` exit 0. Branch re-pushed with the verdict commit `2f2ab18a` riding along. The one acceptance box for the real post-merge run stays unticked, as instructed.
