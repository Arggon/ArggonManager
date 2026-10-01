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
