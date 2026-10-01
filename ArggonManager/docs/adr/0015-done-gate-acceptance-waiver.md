# 0015 Done gate: enforce acceptance-checklist completeness on the terminal flip, with an explicit waiver

- Status: Accepted
> Status note (2026-10-01): flipped from "Proposed (Accepted on merge)" — landed via PR #442 (commit c801aea6, kernel done gate + `--waive`); shipped and documented in CHANGELOG 0.4.1. The status line had lagged the merge.

- Date: 2026-09-29
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Programme: `task-done-gate-acceptance-waiver` (C1 of `exploration-methodology-improvements-014`)

## Context

"Done = acceptance checklist complete (or explicitly waived in Notes with
rationale)" is stated prose in `ArggonManager/docs/agents.md` §5 — the kernel
does not enforce it. Acceptance-awareness exists only in the container
cascade: `acceptanceComplete` vetoes ancestor auto-completion
(`lib/src/update.ts`, `task-cascade-acceptance-aware`), but a claimable item's
own `→ done` flip is unchecked. An item can reach `done` with an unchecked
checklist through a plain `arggon update <id> --status done` or through the
auto-done workflow flipping it on merge (F1 of
[exploration-methodology-improvements-014](../explorations/exploration-methodology-improvements-014.md)).

The gate must be escapable, not absolute: §5 already recognizes the explicit
waiver ("or explicitly waived in Notes with rationale"), and auto-done flips
items whose checklists a human chose not to tick — a refusal the automation
cannot resolve itself must not wedge the pipeline. So the decision has two
halves: the gate, and a recorded escape hatch.

## Decision

1. **Terminal-transition gate on claimable types.** Any `→ done` status
   transition of a claimable item (`task`/`bug`) whose body carries unchecked
   acceptance checkboxes (`- [ ]`, leading whitespace tolerated — the same
   predicate the cascade already computes, `acceptanceComplete`) is refused
   with an actionable error naming the escape hatch:
   `--waive "<reason>"`. Items without any checklist are unaffected (no
   acceptance contract means nothing to gate). Containers
   (`story`/`epic`/`initiative`) keep the existing behavior — their terminal
   flips are not gated here; the acceptance-aware cascade (and, for containers,
   the human editing the file) remains their contract, so there is no double
   gate.
2. **Explicit recorded waiver.** `arggon update <id> --status done --waive
"<reason>"` is the only way past the gate for an incomplete checklist.
   The reason must be non-empty (blank/whitespace reason is refused). The
   waiver is recorded in the item body as a dated Notes-style section
   (`### Waiver <date>` with the reason) BEFORE the status flips, so the
   item's own history carries the rationale — the prose rule's "explicitly
   waived in Notes" becomes what the kernel writes, not what the agent
   remembers to write. `--waive` without `--status done` on a claimable item
   is refused (the flag has no other meaning); the gate applies to every
   `→ done` transition path (`todo`→`done` stays unreachable via the
   transition table; `blocked→done` and `in_progress→done` are both gated).
   Reopen rules, the transition table, and the container cascade are
   unchanged.
3. **MCP stays refusal-only.** The `arggon_update` MCP tool gets NO waive
   parameter (documented parity exception, same shape as `--force`/`--steal`):
   agents receive the refusal naming the flag and coordinate with a human.
   Waivers are human judgment calls.
4. **Automation tolerates the refusal.** The auto-done workflow
   (`.github/workflows/auto-done.yml`) posts a warning annotation and
   continues when the flip is refused by the gate — mirroring its existing
   skipped-todo handling. An unticked checklist is a yellow flag for a human,
   never a red flip run.

## Consequences

- The default path is honest: an item cannot silently reach `done` with an
  open acceptance contract. The failure is loud, actionable, and points at the
  one sanctioned escape.
- Waivers are visible and dated in the item body, reviewable in the PR and on
  the board — "explicitly waived in Notes" stops being honor-system prose.
- Agents (MCP/native callers) can never waive; they must either complete the
  checklist or surface the refusal. This is deliberate friction.
- New failure surface: an auto-done flip refused by the gate leaves the item
  `in_progress` after merge until a human acts (the warning annotation names
  it) — accepted, because the alternative is a silent dishonest `done`.
- `--waive` is additive CLI surface: `schemaVersion` is unchanged; refusal
  errors ride the existing `UPDATE_FAILED` envelope code.

## Alternatives considered

- **No gate; keep it prose.** Status quo is the failure the exploration
  documented (F1): the checklist rule is unenforceable and silently violated.
  Rejected.
- **Gate without a waiver flag.** Humans would edit the file by hand to flip
  `status: done`, bypassing the kernel entirely — the worst of both worlds
  (no enforcement, no recorded rationale). The escape hatch must live in the
  tool.
- **Also gate container terminal flips.** Containers already have the
  acceptance-aware cascade veto plus manual-edit review; a second gate would
  double-lock the same contract and break `update --status done` on
  administrative containers with placeholder checklists (init templates ship
  unchecked boxes). Rejected — no double gate.
- **MCP `waive` parameter with `agent: false` only.** Equivalent to refusal
  for every real MCP caller (the MCP layer always sets `agent: true`), but
  invites a future accidental flip surface. The documented exception is
  simpler and matches the `--force`/`--steal` precedent.
- **Frontmatter `waived: <reason>` field instead of a body section.** A
  waiver is narrative history, not queryable state; the body keeps
  frontmatter minimal and makes the rationale show up in `show`/PR diffs the
  same way steal notes do.
