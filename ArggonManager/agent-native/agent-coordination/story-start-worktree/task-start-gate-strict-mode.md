---
type: task
status: in_progress
id: task-start-gate-strict-mode
title: "Opt-in strict start gate: fail the claim commit when a reported gate bin resolves outside the worktree (x-tracker flag)"
assignee: Arggon
branch: feat/task-start-gate-strict-mode
parent: story-start-worktree
labels: [worktree, opencode-seam]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T12:46:49.702Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-start-gate-strict-mode
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/task-start-gate-strict-mode.md
  Leaves live only under a story. id is the filename stem: task-start-gate-strict-mode.
  CLI `arggon create task start-gate-strict-mode` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Opt-in strict start gate: fail the claim commit when a reported gate bin resolves outside the worktree (x-tracker flag)

## Context

PR #517 (bug-start-worktree-npm-ci-claim) made worktree readiness report `gateBins` — which node_modules each gate binary resolves from (`worktree`/`external`/`path`/`missing`) — report-only: the claim commit stays authoritative (documented honest-receipt design). Four real incidents of the failure class are recorded on bug-start-worktree-npm-ci-claim, including the no-link-farm flavor (#521), so strict mode must cover "bin missing everywhere", not just sibling resolution.

This item adds the OPT-IN strict mode: `x-tracker.strict-gate-bins: true` in the tracker `.convention.yml` hard-fails the claim commit when `inspectGateBinResolution` reports any gate bin resolving OUTSIDE the worktree (`external`, `path`, or `missing`), with an actionable error naming the bin, its observed source, and the `npm ci` remediation. Unset (the default) is byte-identical to the report-only behavior.

## Acceptance

- [x] Flag implemented: `x-tracker.strict-gate-bins` (kernel `TrackerConfig.strictGateBins`, parse + boolean validation + ignore-unknown); default behavior byte-identical when unset (existing tests + smoke:native-start-cold default mode unchanged and green); when set, the claim commit FAILS with an actionable error naming the offending bin, its observed source, and the npm ci remediation.
- [x] Documented: ArggonManager/docs/convention.md (§Tracker hygiene config key + semantics) + ArggonManager/docs/json-output.md (§start envelope prose: not-attempted receipt + flag effect; §cleanup untouched for the parallel PR).
- [x] smoke:native-start-cold covers BOTH modes: default report-only receipts (existing sections + 4b flavor 1 claim lands), strict satisfied claim lands (4a), strict refusing both flavors (5a: path + missing, not-attempted receipt, item copy stays todo).
- [x] Tests pin the failure path at kernel + CLI + native-receipt level (#517 layout): lib/src/worktree.test.ts (strictGateBinViolations/strictGateBinFailure: null for worktree/empty, message pins bin+source+npm ci for path/missing/external), cli/src/start.test.ts (refused before commit; default commits with the same receipt; strict+satisfied commits), opencode/plugins/arggon/tools.test.ts (START_FAILED not-attempted with reason "strict gate-bin gate refused", item todo, remediation loop to a green attach; strict+satisfied commits).
- [x] Gates: npm test, lint, build, check:plugin (bundle regen as the separate final `chore: regen plugin bundle` commit), `npm run arggon -- validate` ok:true.

## Notes

### 2026-10-01 @Coordinator

### 2026-10-01 @Coordinator

Filed from the bug-start-worktree-npm-ci-claim review (PR #517): readiness reporting is deliberately report-only (claim commit authoritative; honest-receipt design). This item: an opt-in x-tracker flag that HARD-FAILS the claim commit when inspectGateBinResolution reports any gate bin resolving outside the worktree. Acceptance: flag documented (convention.md + json-output.md), default behavior unchanged, smoke:native-start-cold covers both modes, tests pin the failure path. Context: the full strict-mode question was truncated by the handoff field cap — recorded here in full instead.

### 2026-10-01 @Arggon
Implemented on feat/task-start-gate-strict-mode — PR #533 (ready for review; NOT merged, coordinator's call).

FLAG + SEMANTICS: `x-tracker.strict-gate-bins: true` in the tracker .convention.yml (kernel TrackerConfig.strictGateBins; boolean-validated, ignore-unknown preserved). When armed, start --worktree (CLI + native) refuses the claim commit when the preparation receipt (gateBins) reports any declared gate bin resolving OUTSIDE the worktree: external (parent install), path (sibling .bin on PATH), or missing (resolves nowhere — the no-link-farm flavor). Refusal happens BEFORE the claim update (item file untouched), the worktree is kept, and the failure names each offending bin + observed source + the npm ci fix + the attach re-run. Unset = byte-identical report-only behavior; an empty gateBins report never violates the gate.

DEFAULT-MODE PROOF: existing kernel/CLI/native tests + smoke sections 1-4 and 4b unchanged and green (flavor 1 still lands with a report-only receipt; flavor 2 still fails at the real gate); new CLI test runs the SAME violating fixture with the flag unset and asserts committed=true with the same gateBins receipt.

FAILURE PATH PINNED AT ALL THREE LEVELS (#517 layout): lib/src/worktree.test.ts (strictGateBinViolations/strictGateBinFailure: null for worktree-sourced + empty; message pins bin+source+npm ci+worktree path for path/missing/external), cli/src/start.test.ts (refused before any commit call; default commits; strict+satisfied commits), opencode/plugins/arggon/tools.test.ts (START_FAILED, claimCommit {status: "not-attempted", reason: "strict gate-bin gate refused"}, item copy stays todo, full remediation loop — worktree-local install flips the resolution and the attach re-run commits; strict+satisfied lands).

SMOKE (both modes): npm run smoke:native-start-cold 27/27 ok, exit 0 — 4a strict satisfied (flag armed, worktree-owned bin, claim lands, single claim commit on the branch); 5a strict refused BOTH flavors (path + missing: not-attempted receipt, actionable message, worktree kept, item copy todo). Default sections untouched.

GATES (expected vs observed): npm test 112 files / 1994 tests passed (was 1968 at #517; +26 since incl. my 14: 5 kernel + 3 CLI + 2 native + 4 config-parse); npm run lint clean; npm run build ok; check:plugin green AFTER the separate final "chore: regen plugin bundle" commit cec576de (bundle diff is exactly the strict-gate addition — do not squash it away); npm run arggon -- validate ok:true 0 warnings. Claim commit 98e6eb72 landed through the green pre-commit gate (after a worktree-local npm ci — see the incident note below). Docs: convention.md §Tracker hygiene (config key + semantics) + json-output.md §start prose (not-attempted receipt + flag effect); §cleanup untouched (parallel PR owns it).

FINDING FOR THE COORDINATOR (suspected FIFTH incident of the class, no item filed per scope rules): this item's own tools.arggon.start --worktree claim (2026-10-01T12:46Z) was skipped with "git commit failed: sh: line 1: tsx: command not found" AND the fresh worktree had NO node_modules at all — although the primary checkout HAS a full install, so linkNodeModules should have created a farm/bare symlink (the #521 no-link-farm flavor, now post-#517). Remediated per the documented path (worktree npm ci + re-run start to attach). Root cause of the missing farm not diagnosed here (out of scope) — worth a look before the class is declared closed.

### handoff 2026-10-01 @Arggon (session: ses_f087fbfeaffeG1DPJSt3EYuOpU) — next: Review PR #533 (https://github.com/Arggon/ArggonManager/pull/533); merge after the review bar — do not squash away cec576de (chore: regen plugin bundle, the check:plugin receipt). Item stays in_progr…
- branch: feat/task-start-gate-strict-mode
- open questions: 1) Root-cause the suspected fifth incident: start --worktree left this worktree with NO node_modules although the primary has a full install (comment on this item has the observed facts); 2) should t…
### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: approve (lead-architect review; reviewer PASS on all seven bars)
- Default byte-identity proven in code (flag-unset path adds only the === true comparison; the same violating fixture with flag unset commits with the identical receipt; zero existing assertions deleted).
- Strict correctness: refusal before claim update on both surfaces (native claimCommit not-attempted + item stays todo, pinned end-to-end incl. the remediation attach loop); all three non-worktree sources covered; empty report vacuous; re-enforcement on attach is real (pinned in smoke 4a + native test).
- Security/bounds: config parsing mirrors allow-steal discipline; no new subprocess/shell surface; native envelope bounded (2048/500 + kernel MAX_GATE_BINS=8); CLI passes full actionable text per pre-existing convention.
- Docs normative in convention.md + json-output.md; bundle regen separate; smoke 27/27.
- Coordinator rulings: (a) dedicated no-link-farm check NOT in this gate — 'missing' is its gate-observable symptom; farm-layer coverage belongs to bug-start-install-ordering. (b) This repo arms the flag post-merge (done next), treating any refusal as signal per the reviewer. (c) Worker nit (CLI item-todo assert) noted, non-blocking.
- CI: green on the final reconciled head (cli rerun after the known ENOTEMPTY teardown flake — environmental, passes locally; flake class already tracked).
