---
type: bug
status: done
id: bug-start-worktree-npm-ci-claim
title: start --worktree claim commit failed in a fresh worktree until a manual npm ci (tsx resolved from a sibling worktree)
assignee: Arggon
branch: fix/bug-start-worktree-npm-ci-claim
parent: story-start-worktree
labels: [worktree, review-followup]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
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

### 2026-10-01 @ses_f0aa6a0b4ffejwR5KRHGYGhyVR
Fixed on fix/bug-start-worktree-npm-ci-claim — PR #517 (draft, ready for review).

MECHANISM: the receipt already reported install:"missing"/ready:false, but nothing named WHICH node_modules the gate binary resolved from, and a sibling's .bin on PATH could run the gate with the claim landing invisibly on a broken install. Readiness now probes inspectGateBinResolution (kernel): declared deps exposing a bin (or, uninstalled, their own name — npm's string-bin convention) are resolved in the gate's real lookup order (worktree module walk → parent dirs → PATH) and reported as gateBins [{name, source: worktree|external|path|missing, path?}]; ready additionally requires every reported bin to resolve inside the worktree. CLI envelope carries gateBins; both failure errors (CLI + native) name the observed source + the exact "npm ci in the worktree, then attach" remediation.

EVIDENCE (expected vs observed):
- Live reproduction during this item's own claim: start --worktree → commit.skipped "git commit failed: sh: line 1: tsx: command not found" (no node_modules in the fresh worktree; which tsx → not found). Remediated per the designed path: worktree-local npm ci + re-run start → attached, claim commit 97268fc0 landed through the green gate. Third occurrence, consistent with both incident comments.
- npm run smoke:native-start-cold → 23/23 ok, exit 0. New checks: (1) "the readiness receipt names the gate bin as resolving INSIDE the worktree" — observed gateBins [{native-gate-dep, worktree, <worktree>/node_modules/.bin/native-gate-dep}] through the link farm; (2) flavor 1 (wrong source): sibling .bin prepended to PATH → gate PASSED, claim landed, receipt observed [{native-gate-dep, path, <sibling>/node_modules/.bin/native-gate-dep}], ready:false; (3) flavor 2 (missing install): clean PATH → claim commit failed, error observed containing "native-gate-dep: not resolvable from the worktree" and "npm ci", receipt gateBins [{native-gate-dep, missing}].
- Gates: npm test 110 files / 1968 tests passed (8 new kernel tests, CLI failure-message test, native receipt/failure tests); npm run lint clean; npm run build ok (incl. typecheck configs); npm run check:plugin → bundle regenerated (committed separately as "chore: regen plugin bundle"); npm run arggon -- validate --json → ok:true, 0 warnings.

### handoff 2026-10-01 @ses_f0aa6a0b4ffejwR5KRHGYGhyVR (session: ses_f0aa6a0b4ffejwR5KRHGYGhyVR) — next: Review PR #517 (draft); merge after review bar — do not squash the chore bundle commit away, it is the check:plugin receipt.
- branch: fix/bug-start-worktree-npm-ci-claim
- open questions: Should start BLOCK the claim commit when a gate bin resolves outside the worktree? Kept report-only (documented best-effort contract: the claim commit stays authoritative); a reviewer may want a stri…

### 2026-10-01 @ses_f0aa6a0b4ffejwR5KRHGYGhyVR
Review follow-up (request-changes finding) — docs added in 19740b69 on the same branch/PR #517:

1. Contract docs now travel with gateBins, mirroring precedent 9c21e293: ArggonManager/docs/json-output.md (gateBins row in the start --worktree envelope table, "Additive within schemaVersion: 1" phrasing, plus the failure-message prose), ArggonManager/docs/agents.md (receipt field list + ready is the conjunction of FOUR clauses — gate-bin resolution inside the worktree, vacuous when nothing declared exposes a bin), ArggonManager/docs/opencode2.md (native receipt enumeration + fourth clause), and ArggonManager/docs/playbooks/opencode.md (same enumeration the precedent updated — included for consistency, flagged here since it was beyond the literal four-item list).
2. skills/arggon-cli/ keep-in-sync duty (engineering.md): checked, nothing to sync — the skill documents readiness at the link-farm level (linkedNodeModules/linkedWorkspaces) and, exactly like precedent 9c21e293 for manifestCoverage/missingDependencies, does not enumerate the receipt fields or clauses. Commands unchanged, so npm run skills:sync has no drift; not run per instructions (nothing touched under skills/). The "checked, nothing to sync" note is recorded in the PR body.
3. Handoff truncation correction: the truncated open question ("Should start BLOCK the claim commit when a gate bin resolves outside the worktree? Kept report-only (documented best-effort contract: the claim commit stays authoritative); a reviewer may want a stricter gate for native start — e.g. refuse the claim commit, or fail start, when gateBins reports a non-worktree source, rather than only reporting it") is superseded by the full filing in task-start-gate-strict-mode — track the decision there.
4. Wording correction: the evidence comment above says "PR #517 (draft, ready for review)" — the PR was opened as a draft and has since been marked READY (state OPEN, isDraft false as of the review); the "draft" label is stale, the review request stands.
### 2026-10-01 @Coordinator
verdict: request-changes (docs travel with the contract change — single blocker)
- BLOCKING (B1, reviewer-verified): gateBins is now part of TWO documented contracts but no normative doc moved: ArggonManager/docs/json-output.md start --worktree envelope table lacks the gateBins row (cli.ts:2275 emits it); ArggonManager/docs/agents.md:193 "ready is the conjunction of three clauses" is now four (lib/src/worktree.ts:924-929) + receipt field list omits gateBins; ArggonManager/docs/opencode2.md:111 native preparation enumeration same staleness (index.ts:2214 forwards gateBins); skills/arggon-cli/ sync line. Precedent: 9c21e293 updated all four docs in-PR for the comparable receipt extension. Fix is mechanical — land it on this PR.
- Everything else PASSES: scope (11 files, bundle regen standalone), security (read-only probe, no writes/subprocess/interpolation), kernel logic (resolution order matches npm-run semantics; empty report = unchanged semantics), tests (8 new kernel tests + CLI failure message + native receipt; smoke 23/23 with both incident flavors — coordinator re-ran worktree/start tests 46/46 and the smoke green), ticks honest.
- Contract call ENDORSED: report-only readiness with named-source errors is the right reading of the documented design; opt-in strict mode filed as follow-up (p4).
- Non-blocking notes accepted: kernel conjunction unit gap (env-injected PATH case), CLI path/external wording branches, handoff truncation (tracker field cap — re-record the full strict-mode question as a plain comment in the fix pass), stale "draft" wording, sanitize asymmetry, bounds consistency.
