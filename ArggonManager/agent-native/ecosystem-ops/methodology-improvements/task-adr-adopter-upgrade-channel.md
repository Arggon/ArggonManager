---
type: task
status: todo
id: task-adr-adopter-upgrade-channel
title: adr-adopter-upgrade-channel
parent: methodology-improvements
labels: []
priority: p1
created: "2026-09-29"
updated: "2026-09-29"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr-adopter-upgrade-channel.md
  Leaves live only under a story. id is the filename stem: task-adr-adopter-upgrade-channel.
  CLI `arggon create task adr-adopter-upgrade-channel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# adr-adopter-upgrade-channel

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon
### Context — C4a (exploration-methodology-improvements-014, exploration-007)

exploration-adopter-upgrade-experience-007 recommended a staged adopter-upgrade channel, but its ADR placeholder (`0009-adopter-upgrade-channel`) was never written and 0009 is now taken by item-priority. Write the decision as the next free number: **0014** (0015 is reserved for the done-gate ADR — coordinate, don't renumber).

The ADR records the adopter-upgrade-channel decision: adopters receive methodology updates by re-running `arggon init` (untouched generated docs refresh silently; modified ones are never clobbered — reported, `--backup` archives); `arggon doctor` reports staleness/provenance as the visibility stage; any proposal-file stage (`init --propose`) from exploration-007 is recorded explicitly as accepted-now or deferred-with-rationale. Read exploration-007 in full first and align, or record the deviation with rationale.

### Acceptance checklist
- [ ] `docs/adr/0014-adopter-upgrade-channel.md` — Status: Proposed → Accepted on merge; Date; Deciders; Context / Decision / Consequences / Alternatives considered.
- [ ] Aligned with exploration-007's recommendation (or deviation recorded).
- [ ] exploration-007 `## Decision` section links the ADR.
- [ ] Docs-only PR; no code changes; `arggon validate` ok.
