---
type: task
status: todo
id: task-repo-visibility-decision
title: Decide repo visibility (public vs private) and execute the readiness checklist if private
parent: operating-principles
labels: [process]
priority: p1
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/operating-principles/task-repo-visibility-decision.md
  Leaves live only under a story. id is the filename stem: task-repo-visibility-decision.
  CLI `arggon create task repo-visibility-decision` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Decide repo visibility (public vs private) and execute the readiness checklist if private

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34e96524ffeT4C9PcMAtYTyfx
## Context

`exploration-repo-visibility-001` (2026-09-22) measured the public→private impact. Key inputs:

- Public: Actions free/unlimited on 4 vCPU runners; private: 2,000 min/mo (Free) / 3,000 (Pro), 2 vCPU, $0.006/min Linux 2-core overage. Measured burn 2,782 wall-minutes / 1,489 runs in 18.2 days (~4.6–5.9k billable min/mo → ~$16–23/mo overage, plausibly $25–50 once 2-core slows the suites). Quota is account-wide.
- Protected branches/rulesets are Pro+ features for private repos (main's required `cli` check + strict/linear-history/conversation gates are at risk on Free).
- Secret scanning/push protection are free for public, paid for private; npm provenance and artifact attestations are impossible/unavailable from a private repo.
- npm tarballs (MIT) and 19 days of public git history are already distributed; going private only protects future source and the tracker.

## Acceptance

- [ ] Decision recorded (ADR or item comment): stay public or go private, with rationale
- [ ] If private: account plan checked (Pro needed to keep branch protection/rulesets on main)
- [ ] If private: Actions budget / trigger reduction decided (e.g. `paths-ignore` for tracker-only commits on `ci.yml`)
- [ ] If private: secret scanning + push protection enabled while still public (free), or accepted as unavailable
- [ ] If private: npm metadata (`repository`/`homepage`) + trusted publishing/provenance decided while public (impossible after)
- [ ] If private: `task-ci-recipe-published-one-liner` and `task-retire-opencode2` landed first
- [ ] If stay public: close with the recorded rationale (no further action)
