---
type: task
status: todo
id: task-done-gate-acceptance-waiver
title: done-gate-acceptance-waiver
parent: methodology-improvements
labels: []
priority: p1
created: "2026-09-29"
updated: "2026-09-29"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-done-gate-acceptance-waiver.md
  Leaves live only under a story. id is the filename stem: task-done-gate-acceptance-waiver.
  CLI `arggon create task done-gate-acceptance-waiver` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# done-gate-acceptance-waiver

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon
### Context — C1 (exploration-methodology-improvements-014)

"Done = acceptance checklist complete" is prose today: `acceptanceComplete` only guards the container cascade (`lib/src/update.ts:916`); a claimable item's own `→ done` flip is unchecked. Add the kernel gate + explicit waiver.

Design constraints:
- Refuse `arggon update <id> --status done` for claimable types when the body has unchecked acceptance checkboxes; error is actionable and names `--waive "<reason>"`.
- `--waive` requires a non-empty reason and records the waiver in the item body (dated Notes/waiver section) before flipping. Refusal without the flag is the default; agents may waive with recorded rationale.
- MCP `arggon_update` has no waive parameter → MCP callers get the refusal (documented; additive parity-test exception if needed).
- Container cascade unchanged (it already skips acceptance-incomplete — no double gate). Gate applies to any `→ done` transition on claimable types.
- `auto-done.yml` tolerates the refusal: warning annotation + continue (mirror the existing skipped-todo handling), never a red flip run.

### Acceptance checklist
- [ ] ADR **0015** in same PR: `docs/adr/0015-done-gate-acceptance-waiver.md` (0014 is reserved for the adopter-upgrade-channel ADR) — Status: Proposed → Accepted on merge; Context/Decision/Consequences/Alternatives.
- [ ] Kernel gate + `--waive` with unit tests: incomplete checklist refused (exit + error names the flag), empty waiver reason refused, waiver with reason flips + records dated section, complete checklist flips without flag, containers unaffected.
- [ ] Fixture updates: each gate rule has a fixture case; validate fixtures stay green.
- [ ] `.github/workflows/auto-done.yml` tolerates the refusal with a warning annotation.
- [ ] Docs: README update section (`--waive`), `ArggonManager/docs/json-output.md`, `docs/agents.md` §5 one-liner, `docs/convention.md` if it states done criteria, skill references (methodology/pitfalls) edited in `skills/arggon-cli/` **and** re-copied byte-equal to `.agents/skills/arggon-cli/`.
- [ ] Smoke evidence on a fixture repo: refuse / waive / complete paths probed with expected vs observed (deterministic `--json`).
- [ ] Full suite + lint/typecheck green; `arggon validate` ok.
- [ ] Merge-order note: this PR and `task-spec-analyze-decision-gaps` both touch README + json-output.md — rebase before opening if the other merged first.
