---
type: task
status: in_progress
id: task-done-gate-acceptance-waiver
title: done-gate-acceptance-waiver
assignee: Arggon
branch: feat/task-done-gate-acceptance-waiver
parent: methodology-improvements
labels: []
priority: p1
created: "2026-09-29"
updated: "2026-09-29"
claimed_at: "2026-09-29T23:07:55.661Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-done-gate-acceptance-waiver
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

- [x] ADR **0015** in same PR: `docs/adr/0015-done-gate-acceptance-waiver.md` (0014 is reserved for the adopter-upgrade-channel ADR) — Status: Proposed → Accepted on merge; Context/Decision/Consequences/Alternatives.
- [x] Kernel gate + `--waive` with unit tests: incomplete checklist refused (exit + error names the flag), empty waiver reason refused, waiver with reason flips + records dated section, complete checklist flips without flag, containers unaffected.
- [x] Fixture updates: each gate rule has a fixture case; validate fixtures stay green.
- [x] `.github/workflows/auto-done.yml` tolerates the refusal with a warning annotation.
- [x] Docs: README update section (`--waive`), `ArggonManager/docs/json-output.md`, `docs/agents.md` §5 one-liner, `docs/convention.md` if it states done criteria, skill references (methodology/pitfalls) edited in `skills/arggon-cli/` **and** re-copied byte-equal to `.agents/skills/arggon-cli/`.
- [x] Smoke evidence on a fixture repo: refuse / waive / complete paths probed with expected vs observed (deterministic `--json`).
- [x] Full suite + lint/typecheck green; `arggon validate` ok.
- [x] Merge-order note: this PR and `task-spec-analyze-decision-gaps` both touch README + json-output.md — rebase before opening if the other merged first.

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

- [x] ADR **0015** in same PR: `docs/adr/0015-done-gate-acceptance-waiver.md` (0014 is reserved for the adopter-upgrade-channel ADR) — Status: Proposed → Accepted on merge; Context/Decision/Consequences/Alternatives.
- [x] Kernel gate + `--waive` with unit tests: incomplete checklist refused (exit + error names the flag), empty waiver reason refused, waiver with reason flips + records dated section, complete checklist flips without flag, containers unaffected.
- [x] Fixture updates: each gate rule has a fixture case; validate fixtures stay green.
- [x] `.github/workflows/auto-done.yml` tolerates the refusal with a warning annotation.
- [x] Docs: README update section (`--waive`), `ArggonManager/docs/json-output.md`, `docs/agents.md` §5 one-liner, `docs/convention.md` if it states done criteria, skill references (methodology/pitfalls) edited in `skills/arggon-cli/` **and** re-copied byte-equal to `.agents/skills/arggon-cli/`.
- [x] Smoke evidence on a fixture repo: refuse / waive / complete paths probed with expected vs observed (deterministic `--json`).
- [x] Full suite + lint/typecheck green; `arggon validate` ok.
- [x] Merge-order note: this PR and `task-spec-analyze-decision-gaps` both touch README + json-output.md — rebase before opening if the other merged first.

### 2026-09-30 @Arggon
Evidence for review (all commands run in the worktree; fixture probes against dist/cli.js built from this branch):

- Full suite: npm test -> 105 files / 1734 tests passed. Lint: npm run lint -> clean. Build: npm run build -> ok (lib + typecheck + plugin bundle rebuilt). Tracker gate: npm run arggon -- validate --json -> {ok:true, errors:[], warnings:[]}.
- New suite cli/src/done-gate.test.ts (14 tests) pins every gate rule: refusal naming --waive, transition-table precedence (todo/blocked -> done refused even with --waive), empty/whitespace reason, nothing-to-waive (no flip / container / complete checklist), agent refusal, waiver section format, waived body stays unchecked, containers unaffected, cascade unchanged, UPDATE_FAILED envelope.
- Fixture probes (/tmp/fixture-c1, deterministic --json, expected vs observed):
  1. update task-rate-limit --status done (in_progress, unchecked template box) -> exit 1, {ok:false, code:UPDATE_FAILED, message names --waive "<reason>"} — as expected.
  2. --waive "" -> exit 1, '--waive requires a non-empty reason' — as expected.
  3. --waive 'accepted as-is by coordinator' -> exit 0, status done; show --body displays '### Waiver <date>' + reason; body boxes remain unticked — as expected.
  4. task-cookies with fully-ticked checklist flips WITHOUT the flag -> exit 0 — as expected.
  5. --waive on a done item (nothing to waive) -> exit 1 — as expected. validate --json ok on the fixture.
- Blast radius handled in-PR: ~60 existing done-flip call sites across 13 test files arrange ticked checklists via the shared helper test/acceptance.ts (no test-only kernel bypass); import-issues self-waives closed-issue flips with reason 'imported as closed from GitHub issue #<n>' (body may carry task lists); opencode-smoke ticks the box before its close session; auto-done.yml tolerates the refusal in BOTH the flip loop and redo_flip with a ::warning:: annotation.
- MCP: arggon_update has NO waive property (parity exception documented in cli/src/mcp-parity.test.ts); kernel also refuses agent callers as defense in depth. schemaVersion unchanged.
