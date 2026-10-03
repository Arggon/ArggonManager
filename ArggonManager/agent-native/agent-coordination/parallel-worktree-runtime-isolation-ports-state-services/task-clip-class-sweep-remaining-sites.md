---
type: task
status: todo
id: task-clip-class-sweep-remaining-sites
title: "Clip-order class sweep: `cli/src/board.ts:141` and the kernel `gh auth status` wrappers (`lib/src/get-open-prs.ts:67`, `import-issues.ts:187`, `cleanup.ts:259`) still append their remedy after the detail"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cli, native-seam]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-clip-class-sweep-remaining-sites.md
  Leaves live only under a story. id is the filename stem: task-clip-class-sweep-remaining-sites.
  CLI `arggon create task clip-class-sweep-remaining-sites` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Clip-order class sweep: `cli/src/board.ts:141` and the kernel `gh auth status` wrappers (`lib/src/get-open-prs.ts:67`, `import-issues.ts:187`, `cleanup.ts:259`) still append their remedy after the detail

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Class sweep left open by the worker on PR #608 (task-cli-start-remediation-tail-clipped-on-human-channel), 2026-10-03. That PR fixed four sites and recorded the ones it deliberately did NOT touch, because they belong to other items or surfaces. Same defect class: an actionable remedy appended AFTER the detail, so a head-kept clip eats the remedy first.

**Deferred because the file belongs to a concurrent item:**
- `cli/src/board.ts:141` — identical violation. Owned by `bug-three-acceptance-parsers-diverging` (active now), so it must wait rather than collide.

**Deferred because they are kernel-side, different surface:**
- `lib/src/get-open-prs.ts:67`, `lib/src/import-issues.ts:187`, `lib/src/cleanup.ts:259` — the `gh auth status` wrappers. These are kernel surfaces whose text reaches humans through their own envelopes, so confirm the clipping bound and the remedy's position per surface rather than assuming the CLI's 2000-char clip applies.

**Already verified compliant by that worker** (recorded so the next sweeper does not redo it): `assertStartableTree`, `git()`, the plain non-worktree start, `cli/src/cleanup.ts` refusals (clamped at 500 on a machine surface), and `mcp-server` `spawnedOutcome` (detail already last).

The repeated shape worth naming in the eventual fix: four PRs (#573, #579, #595, #597, and now #608) each fixed one or two call sites, and each time a reviewer or worker found the *next* site. That is what a class defect looks like from inside a per-site workflow — and the reason this item exists rather than another one-line reorder.

Acceptance:
- [ ] Every remedy-after-detail site on every human-facing surface is enumerated and either fixed or recorded compliant — no "swept" claim without the list
- [ ] `cli/src/board.ts:141` fixed (after the parsers item lands, so the two do not collide)
- [ ] The three kernel `gh auth status` wrappers fixed, each with the bound that actually applies to its surface
- [ ] A test or grep-able rule pins the ORDER convention so a future site cannot reintroduce it silently — the same outcome the seam-pin parity work aims at
- [ ] Depends on PR #608 for the board file, not for the kernel wrappers
