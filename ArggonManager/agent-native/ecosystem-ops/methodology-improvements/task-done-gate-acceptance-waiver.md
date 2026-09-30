---
type: task
status: done
id: task-done-gate-acceptance-waiver
title: done-gate-acceptance-waiver
assignee: Arggon
branch: feat/task-done-gate-acceptance-waiver
parent: methodology-improvements
labels: []
priority: p1
created: "2026-09-29"
updated: "2026-09-30"
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

### handoff 2026-09-30 @Arggon — next: Coordinator review: verify ADR 0015 acceptance, run the fixture probes in the evidence comment if desired, then merge (MERGE, never squash). Rebase first if task-spec-analyze-decision-gaps landed on …
- branch: feat/task-done-gate-acceptance-waiver
- open questions: Waiver section heading format (### Waiver <date>) and the strict nothing-to-waive refusal are ADR 0015 semantics — flag in review if the product owner wants laxer waive handling
- [ ] ADR **0015** in same PR: `docs/adr/0015-done-gate-acceptance-waiver.md` (0014 is reserved for the adopter-upgrade-channel ADR) — Status: Proposed → Accepted on merge; Context/Decision/Consequences/Alternatives.
- [ ] Kernel gate + `--waive` with unit tests: incomplete checklist refused (exit + error names the flag), empty waiver reason refused, waiver with reason flips + records dated section, complete checklist flips without flag, containers unaffected.
- [ ] Fixture updates: each gate rule has a fixture case; validate fixtures stay green.
- [ ] `.github/workflows/auto-done.yml` tolerates the refusal with a warning annotation.
- [ ] Docs: README update section (`--waive`), `ArggonManager/docs/json-output.md`, `docs/agents.md` §5 one-liner, `docs/convention.md` if it states done criteria, skill references (methodology/pitfalls) edited in `skills/arggon-cli/` **and** re-copied byte-equal to `.agents/skills/arggon-cli/`.
- [ ] Smoke evidence on a fixture repo: refuse / waive / complete paths probed with expected vs observed (deterministic `--json`).
- [ ] Full suite + lint/typecheck green; `arggon validate` ok.
- [ ] Merge-order note: this PR and `task-spec-analyze-decision-gaps` both touch README + json-output.md — rebase before opening if the other merged first.

### 2026-09-30 @Arggon-Reviewer
verdict: approve (code-read + test-read review; worker's CLI probes cross-checked statically — no shell available in this review dispatch to re-run them)

Kernel gate (lib/src/update.ts, ADR 0015) — verified:
- Fires only on a legal `→ done` flip of a task/bug with unchecked boxes (`flippingToDone && gatedLeaf && !acceptanceComplete(item.body)`, update.ts:494-496). `todo→done` and `blocked→done` are refused by the transition table FIRST (assertUpdateRules, update.ts:445; lib/src/rules.ts:43-52; lib/src/status.ts TRANSITIONS) and `--waive` cannot rescue them — test-pinned (cli/src/done-gate.test.ts:87-111).
- Every refusal precedes any filesystem mutation: the gate sits before the reparent/promotion moves and the write; the whole path runs under the item lock.
- Waiver + flip land in ONE writeFileAtomic temp+rename write (update.ts:773; lib/src/atomic.ts): no state where the waiver is recorded without the flip or vice versa; a failed write leaves the item untouched. Docs say "BEFORE the flip" — intent (rationale travels in the body) is met; strictly it is atomic-with the flip, which is safer than two writes.
- No double gate: containers keep the acceptance-aware cascade veto (skip semantics, lib/src/update.ts autoCompleteAncestors unchanged); leaf gate and cascade veto never both apply to one item (done-gate.test.ts:217-242).
- Agent refusal (update.ts:507-511) mirrors rules.ts phrasing ("human-only escape hatch"); MCP arggon_update has NO waive property with additionalProperties:false (cli/src/mcp-server.ts:190-252) and hardcodes agent:true (mcp-server.ts:657); native plugin bundle rebuilt with identical gate strings and agent:true (.opencode/plugins/arggon/index.ts). Nit: rules.ts's "agent restrictions encoded exactly once" comment is now slightly stale — the waive refusal lives in update.ts (it needs the gated predicate); acceptable since runUpdate is the single funnel.
- Re-indentation check: side-by-side read of main vs branch across the whole apply closure and file tail. Non-whitespace delta is exactly: the gate block, the waiver body-append, UpdateOptions.waive + agent doc line, two re-wrapped throw statements, one re-wrapped ternary in maybeCommitUpdate. No logic drift found.

Surface: cli/src/cli.ts:941 (`--waive <reason>`) threaded into both --json (UPDATE_FAILED envelope, lib/src/operations.ts:343) and plain paths (cli.ts:1028, 1056). done-gate.test.ts (14 tests) pins refusal naming the flag, empty/whitespace reason, nothing-to-waive (no flip / container / complete checklist), agent refusal, waiver section format, waived body stays unchecked, containers unaffected, cascade unchanged, no-checklist body unaffected, already-done no-op, UPDATE_FAILED envelope.

import-issues (lib/src/import-issues.ts:406-423): self-waive is conditional on the exact gate predicate; reason "imported as closed from GitHub issue #<n>" is honest (records GitHub state, not a completion claim); kernel-internal call without agent:true — consistent: import-issues is a human-initiated CLI command recording external truth, and the dated Waiver section keeps it auditable.

auto-done.yml: refusal discriminated by the kernel message substring ("unchecked boxes") in BOTH the flip loop (lines 90-96) and redo_flip (181-182) → ::warning:: annotation, run stays green, item stays in_progress; unexpected failures still annotated (line 98).

Docs/skills/fixtures: README:295, ArggonManager/docs/json-output.md:361, docs/agents.md §5 (:115) + auto-done (:129), docs/convention.md:243 all match the kernel strings; convention.md correctly states the gate is never a validate error. Skill references edited in skills/arggon-cli/ and re-copied — pitfalls.md and methodology.md byte-identical to the .agents/skills copies (modulo the standard generated-file header). Fixture delta is exactly task-session-cookies.md ticked (integration flip path), other fixtures deliberately unchecked (gate path); smoke/opencode-smoke.ts:1531 ticks its box before the close session.

Evidence basis (stated explicitly): the 5 --json fixture probes recorded in the item body (refuse / empty-waive / waive+record / complete-without-flag / nothing-to-waive) match the kernel error strings line-by-line; suite/lint/build/validate green is the worker's recorded run. I could NOT re-run the CLI probes, npm test, or read PR CI in this dispatch (no shell); the unit suite pins the same rules the probes exercise.

Non-blocking findings (recommend filing as follow-up items):
1. CLI --waive has no interactive/TTY gate: an agent driving the CLI (no agent flag) can waive. Precedent split: --steal/reopen got CLI TTY gates (bug-cli-steal-not-gated, bug-reopen-ungated-cli); --force did not. ADR 0015 scopes the restriction to MCP/native + kernel agent flag and the docs describe the mechanism honestly — not a merge block, but a TTY/caller-identity gate for --waive deserves a follow-up.
2. ADR 0015 records the human-only waiver decision and rationale but never explicitly notes the deviation from the work-order constraint "agents may waive with recorded rationale" (the worker flagged it in the item's open questions). One sentence in the ADR would make the decision change self-documenting.
3. `requested` does not include waive: `--waive "x"` with no other flag fails with the generic "nothing to update" instead of the precise nothing-to-waive message. Cosmetic.
