---
type: task
status: todo
id: task-role-model-report-only-detector
title: "Report-only detector: `accept:` classification in `sync --json` + `spec analyze` finding for a container closed with no recorded acceptance"
parent: role-model-foundation
labels: [methodology, cli, report-only]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
depends_on: [task-spec-promotion-policy-and-acceptance]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-role-model-report-only-detector.md
  Leaves live only under a story. id is the filename stem: task-role-model-report-only-detector.
  CLI `arggon create task role-model-report-only-detector` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Report-only detector: `accept:` classification in `sync --json` + `spec analyze` finding for a container closed with no recorded acceptance

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR 0021 §4 and exploration finding F6: both surfaces this needs already ship —
`arggon sync --json` parses the bounded verdict header and classifies items
report-only (`ArggonManager/docs/engineering.md:109`), and `spec analyze` already
emits decision-pipeline findings (`ArggonManager/docs/agents.md:450`). The work is
two additive rules, not a new tool.

This report is also the **evidence a future kernel gate would need** (ADR 0021 C3
was rejected, not discarded): it must prove low-noise before anyone proposes the
gate again.

## Acceptance

- [ ] Depends on `task-spec-promotion-policy-and-acceptance` (ADR 0017 gate) landing first
- [ ] `sync --json` classifies a reconciled item as `accepted` / `changes-noted` / `none` from the `accept:` header, alongside the verdicts it already classifies; a later `accept: approve` supersedes an earlier `accept: changes-requested`
- [ ] `self-accepted` is reported when the acceptance author equals the item's own assignee (forgery is expected and reported, never blocked)
- [ ] Additive `spec analyze` finding for a container closed with no recorded acceptance; report-only, never fails the run, no NEW-finding noise on a corpus with zero acceptances
- [ ] Report-only on every surface: no transition, no CI failure, no auto-filed item
- [ ] Unit tests travel with the behavior; the verdict-parity tests stay green; `mcp-parity` / `mcp-doc-contract` unaffected (no schema change)
- [ ] Docs updated in the same PR (`docs/json-output.md` payload + envelope surfaces)
- [ ] `arggon validate` + `arggon spec validate` + `npm test` green
