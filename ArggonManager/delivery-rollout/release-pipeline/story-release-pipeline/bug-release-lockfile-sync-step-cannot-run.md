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

- [ ] The fix makes the step's install run without lifecycle scripts (e.g.
      `npm install --package-lock-only --ignore-scripts`) or an equivalent that
      still resolves the lockfile fully — state the choice and why it cannot
      skip a resolution the step needs
- [ ] Recorded root cause with evidence: which runs were inspected (`#664`-era
      sync-step outcomes vs run 38283343454) and whether this is a runner
      environment change or was latent — no guess
- [ ] Verified on a real `release-please.yml` run after the fix lands: the sync
      step completes, pushes the reconciled `package-lock.json` onto the open
      release PR (expect the `@arggondev/lib` spec + workspace version to match
      the PR's `package.json`), and the run is green — expected vs observed
- [ ] Negative case preserved: if the lockfile cannot be produced the step still
      fails loudly (it must never silently pass with a desynced lockfile)
- [ ] `npm ci` on the release PR branch after the sync is green (the #1993
      symptom the step exists to prevent), or a recorded reason why it cannot be
      run
- [ ] `npx actionlint` clean on the changed workflow; `arggon validate` green

## Notes
