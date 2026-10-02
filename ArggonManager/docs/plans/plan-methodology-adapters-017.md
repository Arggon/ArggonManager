---
plan_id: methodology-adapters-017
title: Plan for methodology-first productization + adapters
spec: ArggonManager/docs/specs/spec-methodology-adapters-017.md
status: proposed
created: 2026-10-02
---

# Plan: Methodology-first productization + per-agent native adapters (methodology-adapters-017)

Derived from `ArggonManager/docs/specs/spec-methodology-adapters-017.md`
(contract, ADR 0020 §Decision). Each task carries verifiable acceptance and
links back to the spec. Filesystem layout: per-agent bundles under
`adapters/<agent>/` (T6 note).

## T1: Methodology carriers + README declaration (spec S1)

- Edit `ArggonManager/docs/agents.md`, `docs/engineering.md`,
  `docs/convention.md` headers: declare them the ArggonManager methodology —
  scope (any project), invariants (ADR 0020 list), version tracks the
  package, upgrade channel (ADR 0016).
- `README.md` gains a "The methodology" section: one-paragraph statement +
  links to the carriers + the adapter matrix table.
- **Acceptance:** a fresh reader reaches every carrier from the README in
  one hop; carriers carry the same invariant list verbatim;
  `arggon validate` green; impact class stated as **Behavioral** in the PR
  (agents must re-learn the framing) per agents.md §Changing the methodology
  itself.

## T2: Adapter selection flags (spec S2)

- `arggon init --agents <opencode,zcode,claude>` / `--no-agents`; default =
  detected agents. Generation matrix tested; `--json` reports
  written/skipped per artifact, never overwrites adopter edits.
- `arggon doctor --agents` per-agent: files present/stale/adopter-edited +
  matrix gap rows.
- **Acceptance:** fixture matrix test over the 2×2×2 flag combinations;
  doctor output snapshot test; docs updated in README + agents.md § init.

## T3: Machine-readable capability matrix (spec S3)

- `adapters/capability-matrix.json`: methodology invariant × agent →
  mechanism (native feature), package, gap note. `arggon doctor` prints gap
  rows report-only.
- **Acceptance:** JSON validates in CI (schema test); every gap row has a
  note; doctor output bounded.

## T4: OpenCode V2 adapter expansion (spec S4)

- `prompt` session hook stamps branch/item metadata (`.arggon.env` values)
  on admission; `compaction` hook retains the item block.
- Board panel refreshes from the OpenCode event stream instead of polling.
- **Acceptance:** headless smoke (expected vs observed in the PR verdict);
  unit tests for the hook rewrite contract; permission rules unchanged.

## T5: ZCode adapter expansion (spec S5)

- Generated goal-mode template: objective + verification contract derived
  from the claimed item's acceptance checklist (never spans worktrees).
- Opt-in automation templates: daily spec-drift scan, weekly stale-claim
  sweep — read-only or item-filing only.
- **Acceptance:** template generation test; goal contract parses the
  checklist; automations documented as opt-in; gate hook tests stay green.

## T6: Claude Code adapter, follow-on story (spec S6)

- File the story with acceptance: plugin bundle (skills/agents/hooks/
  commands/MCP), marketplace manifest, headless smoke parity bar.
- **Acceptance:** story filed with checklist, linked from the spec; no code
  in this wave.

Wave plan: T1 → (T2 ∥ T3) → (T4 ∥ T5) → T6. T1 first because the carriers
frame the adapters; T2/T3 independent; T4/T5 disjoint by agent directory;
T6 last.
