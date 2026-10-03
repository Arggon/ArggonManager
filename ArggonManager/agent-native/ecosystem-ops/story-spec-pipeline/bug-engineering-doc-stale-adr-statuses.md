---
type: bug
status: todo
id: bug-engineering-doc-stale-adr-statuses
title: "`docs/engineering.md:230` and spec/plan 009 still describe ADRs 0003/0010 as `Proposed`; 0002/0003/0004 were Accepted in their files by c0cdd60b"
parent: story-spec-pipeline
labels: [docs, adr]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-engineering-doc-stale-adr-statuses.md
  Leaves live only under a story. id is the filename stem: bug-engineering-doc-stale-adr-statuses.
  CLI `arggon create bug engineering-doc-stale-adr-statuses` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/engineering.md:230` and spec/plan 009 still describe ADRs 0003/0010 as `Proposed`; 0002/0003/0004 were Accepted in their files by c0cdd60b

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Commit `c0cdd60b` accepted ADRs 0002/0003/0004 in their FILES but left other surfaces still describing them as `Proposed`:
- `ArggonManager/docs/engineering.md:230` calls ADR 0003 "Proposed" (stale since that commit)
- `ArggonManager/docs/specs/spec-opencode2-009.md:87` and `ArggonManager/docs/plans/plan-opencode2-009.md:24` call ADR 0010 `Proposed` — it is now "Partially superseded by 0011"

Reported (not fixed) by the worker on PR #602 (task-adr-readme-index-missing-adr-0020) while building the ADR index parity test. That PR corrected the index rows for 0002/0003/0004 — it owns the index, and its status-class rule cannot pass otherwise — but reported these rather than widening its diff.

The spec/plan case needs a judgment call, not a blind edit: a spec/plan is a dated record of what was believed at decision time, so it may be CORRECT as history. That is the coordinator's call, hence this item rather than a silent fix.

Acceptance:
- [ ] `docs/engineering.md` no longer describes ADR 0003 as Proposed (it is Accepted); check its whole ADR-status reference list, not just line 230
- [ ] Decide the spec/plan 009 case explicitly: either the dated record is correct as history (record that decision where a reader sees it) or the statements are current-tense claims that must be updated
- [ ] Sweep the docs tree for ADR status claims against the actual files — the index drift recurred at least three times (05b31fb6 fixed 0014-0017; c0cdd60b left 0002-0004; now this)
- [ ] State in the ADR process section that an ADR status change must update every surface describing it, so the sweep is not manual next time
