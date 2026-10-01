---
type: task
status: in_progress
id: task-ci-seam-pin-tracks-release
title: "arggon.yml ARGGON_VERSION pin must track the release (derive from package.json, not a literal)"
assignee: Arggon
branch: feat/task-ci-seam-pin-tracks-release
parent: tooling-and-environment
labels: [ci, release]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T14:29:51.698Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-ci-seam-pin-tracks-release
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-ci-seam-pin-tracks-release.md
  Leaves live only under a story. id is the filename stem: task-ci-seam-pin-tracks-release.
  CLI `arggon create task ci-seam-pin-tracks-release` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon.yml ARGGON_VERSION pin must track the release (derive from package.json, not a literal)

## Context

Filed from the #527 review: the seam was regenerated with 0.4.1 while the committed workflow's literal pin still said 0.4.0, turning `tasks-validate` red on main and every open PR until the pin was moved by hand. This item makes that divergence impossible to merge unnoticed.

**Decision (recorded per the item's "either is acceptable" clause): keep the literal pin, enforce it with a lag-guard test — derive was REJECTED.** Deriving `ARGGON_VERSION` from `package.json` in the workflow installs a version the registry does not have yet between the release bump (step 1) and the publish (step 5): guaranteed red `tasks-validate` on main (and on the release PR) on every release — trading the rare manual re-pin for a certain red window, the exact outage class this item exists to prevent. The shipped template cannot derive either (an adopter's `package.json` version is unrelated to arggon releases). The guard (`cli/src/ci-seam-pin.test.ts`) fails exactly when the pin lags BOTH `package.json` and the newest `arggonVersion` seam stamp — the #527 shape — and stays green through the whole documented release flow (a naive pin==package.json test would be red through every release window).

## Acceptance

- [x] The 0.4.0-pin incident cannot merge unnoticed: `ci/src/ci-seam-pin.test.ts` red on the #527 shape (mutation-verified) with a message naming the fix (re-pin, runbook Gotchas / step 6).
- [x] Guard stays green through the release flow: verdict-table unit tests cover mid-cycle, bump/pre-publish, post-publish/pre-re-pin, re-pin, template-less patch; release-window mutation (package.json bumped, pin not yet) verified green.
- [x] Decision + rationale recorded (derive rejected: registry 404 red window; adopter template can't derive) — in this body, the test header, the workflow comment, and both runbooks.
- [x] Regression guard: the workflow (and template) must keep the literal and never derive (`DERIVE_PIN`/`GITHUB_ENV` asserted absent); a future flip requires a new decision answering the red window.
- [x] Runbooks updated: root `release.md` Gotchas bullet + canonical `ArggonManager/docs/runbooks/release.md` step 6 (both pins move in the same PR as the seam regeneration; guard enforces).
- [x] Workflow verified: YAML parses (python3 yaml), literal pin present, no derive step, install → seam check → validate order intact.
- [x] Gates: `npm run build`, `npm test` (113 files / 2003 tests), `npm run lint`, `npm run check:plugin`, `npm run arggon -- validate --json` (ok:true) — all clean.

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the #527 review: publishing 0.4.1 + regenerating the seam with 0.4.1 turned tasks-validate red on main because .github/workflows/arggon.yml pins ARGGON_VERSION as a literal 0.4.0. The manual re-pin is release-runbook step now documented in release.md; this item removes the foot-gun: derive the pin from the root package.json version (or a workflow-level env referenced from package.json), so publishing and pinning cannot diverge. Acceptance: pin derived/automated, a test or CI check that fails when the pin lags the shipped version, runbook updated.
