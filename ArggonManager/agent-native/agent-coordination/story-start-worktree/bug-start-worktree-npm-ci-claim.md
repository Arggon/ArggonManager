---
type: bug
status: in_progress
id: bug-start-worktree-npm-ci-claim
title: start --worktree claim commit failed in a fresh worktree until a manual npm ci (tsx resolved from a sibling worktree)
assignee: Arggon
branch: fix/bug-start-worktree-npm-ci-claim
parent: story-start-worktree
labels: [worktree, review-followup]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T02:44:39.575Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-start-worktree-npm-ci-claim
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/bug-start-worktree-npm-ci-claim.md
  Leaves live only under a story. id is the filename stem: bug-start-worktree-npm-ci-claim.
  CLI `arggon create bug start-worktree-npm-ci-claim` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# start --worktree claim commit failed in a fresh worktree until a manual npm ci (tsx resolved from a sibling worktree)

## Context

Fresh `start --worktree` worktrees have no install, so the pre-commit gate (`npm run --silent arggon -- validate` → `tsx`) died with `sh: tsx: command not found` — or, worse, ran on a sibling checkout's `.bin` found via PATH, silently masking the broken worktree install. Fixed: readiness now probes and reports which node_modules every declared gate binary resolves from.

## Acceptance

- [x] Reproduce + instrument: the failure mode reproduced live during this item's own claim (commit skipped with `sh: line 1: tsx: command not found`), and readiness now reports the resolution source per gate bin (`worktree` / `external` / `path` / `missing`) in the preparation receipt, the CLI envelope, and the failure errors.
- [x] Both: readiness withholds `ready` unless every reported gate bin resolves inside the worktree, AND the failure errors (CLI `worktreeFailureMessage`, native start failure) name the observed source + the exact `npm ci` remediation. Both flavors captured in `smoke:native-start-cold` (sibling-PATH masking with a landed claim; missing install with a failed claim).
- [x] `npm run smoke:native-start-cold` green (23 checks, extended with the in-worktree assertion + both flavors); `linkedNodeModules`/`linkedWorkspaces` reporting unchanged.

## Notes

### 2026-10-01 @Coordinator

### 2026-10-01 @Coordinator

Filed from the bug-dependency-cycle-chain-rotation-duplicates-a-node worker's environment report (PR #506).

## Context

tools.arggon.start --worktree on a fresh worktree hit a claim-commit failure: the worktree had no npm ci install and tsx resolved from a SIBLING worktree's node_modules. The worker followed the reported remediation (worktree-local npm ci, then re-run start to attach) and the claim commit landed — so the failure/recover path worked as designed, but the readiness prep (link farm + workspace pre-build, see bug-native-start-worktree-no-install) did not cover this tsx/bin resolution case, and a sibling-worktree resolution can silently mask a broken worktree install.

## Acceptance

- [x] Reproduce the cold-worktree claim-commit failure mode, or instrument start readiness to report WHICH node_modules tsx/bin resolve from (worktree vs primary vs sibling).
- [x] Either fix readiness to verify bin/tsx resolution inside the worktree, or extend the failure error to name the observed resolution source + the exact remediation (expected vs observed in the smoke).
- [x] npm run smoke:native-start-cold stays green; linkedNodeModules/linkedWorkspaces reporting unchanged or improved.

### 2026-10-01 @Arggon

Mechanism: the receipt already said `install: "missing"` / `ready: false`, but nothing named the bin resolution — and when PATH luck (a sibling's `.bin`) let the gate pass, the claim landed on a broken install invisibly. Readiness now probes `inspectGateBinResolution` (kernel, `lib/src/worktree.ts`): declared dependencies that expose a `bin` (or, uninstalled, their own name — npm's string-bin convention) are resolved in the gate's real lookup order — worktree module walk (own install → parent dirs) → PATH — and the receipt reports `gateBins: [{name, source: worktree|external|path|missing, path?}]`, capped at `MAX_GATE_BINS`. `ready` now also requires every reported bin to resolve inside the worktree; the CLI (`gateBins` envelope field + human note), the native start receipt, and both failure errors (CLI + native) name the observed source with the `npm ci` remediation. Third live occurrence recorded: this item's own claim commit was skipped with `sh: line 1: tsx: command not found`; remediated per the designed path (worktree `npm ci` + attach).

Evidence: `npm run smoke:native-start-cold` 23/23 ok (new checks: gate bin resolves INSIDE the worktree through the farm; flavor 1 sibling-`.bin`-on-PATH masking — claim lands, receipt names the sibling path, ready:false; flavor 2 no install anywhere — claim fails, error names the missing bin + `npm ci` fix). Kernel 8 new `inspectGateBinResolution` tests; CLI failure-message test; native receipt/failure tests. Gates: npm test, lint, build, check:plugin (bundle regen committed separately), `arggon validate` ok — see the PR.

### 2026-10-01 @Coordinator

### 2026-10-01 @Coordinator

Second incident of the same class, from the bug-tsx-board-dead-script worker (PR #510): start --worktree left the worktree with no install, so the claim commit failed its pre-commit gate; worker recovered via worktree-local npm install + attach. Two independent occurrences (cycle-rotation worker: npm ci + sibling tsx resolution; board worker: no install at all) — strengthening this item's reproduce-first acceptance: capture BOTH flavors (missing install; wrong resolution source) in the readiness report.
