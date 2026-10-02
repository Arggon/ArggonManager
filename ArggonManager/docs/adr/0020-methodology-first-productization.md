# 0020 Methodology-first productization with per-agent native adapters

- Status: Proposed
- Date: 2026-10-02
- Deciders: Gonzalo Arganaraz
- Input: [exploration-methodology-productization-018](../explorations/exploration-methodology-productization-018.md) (2026-10-02)

## Context

ArggonManager's methodology (find → claim → work → review → merge → done,
spec/plan/ADR/exploration pipeline, review bar, docs-that-travel-with-code)
exists implicitly across `docs/agents.md`, `docs/engineering.md`,
`docs/convention.md` and the `arggon-cli` skill. Per ADR 0011 it is "the
contract", yet it is not versioned or presented as the product, and its
enforcement is uneven across agents: OpenCode V2 and ZCode have native seams
(ADR 0010/0011, ADR 0014), Claude Code has only a `CLAUDE.md` pointer. The
adapters that do exist underuse their agents' distinctive capabilities (ZCode
Goal Mode and automations are unexploited; OpenCode session hooks and TUI
panels are only partially used; Claude Code's plugin/hook/marketplace model is
unused).

The frontier interview settled three maintainer constraints: keep everything
in this repo (no fork), target OpenCode V2 + ZCode first, and validate via
exploration + ADR + spec + plan with tasks filed.

## Decision

Adopt **C1** from the exploration:

1. **Promote the methodology carriers to the product surface.** Declare
   `ArggonManager/docs/agents.md`, `docs/engineering.md`, `docs/convention.md`
   and the bundled `arggon-cli` skill as _the ArggonManager methodology_ —
   scope (general projects, not only software), invariants (humans and agents
   follow the same rules; state in git; discipline enforceable; docs travel
   with code; never-steal/never-reopen), versioned with the package.
2. **Per-agent adapters** built on the same kernel: OpenCode V2 (plugin
   transforms, session hooks, TUI panels, permissions, worktree domain),
   ZCode (plugin marketplace, hooks, **Goal Mode**, **automations**), Claude
   Code (plugin bundle + marketplace — follow-on story).
3. **A capability matrix**, machine-readable and report-only via `arggon
doctor`: methodology invariant × agent → native mechanism or explicit gap.
4. `arggon init` gains adapter selection (e.g. `--agents opencode,zcode`),
   defaulting to every detected agent.

Rejected: **C2** (standalone methodology package — premature distribution
surface), **C3** (status quo — leaves the methodology invisible and the
Claude Code gap perpetual).

## Consequences

- Methodology edits become product decisions with the ADR 0016 impact
  classification attached; behavioral edits must reference the adopter
  upgrade channel.
- Every adapter's enforcement must delegate to the kernel — no adapter
  forks a rule (one logic path invariant from ADR 0010/0011/0014 stands).
- ZCode Goal Mode/automations and OpenCode hooks/TUI become product
  commitments: each needs a smoke story before merge.
- Claude Code adapter is a follow-on story with the same bar; today it
  remains docs + `CLAUDE.md`.
- Non-software applicability is a scope statement, not a new schema:
  branch/PR model stays, verified sane for docs/research/ops repos.

## Alternatives considered

See the exploration: C2 (extract `@arggondev/methodology`), C3 (status quo).
Also considered: making MCP the only cross-agent surface (rejected — MCP is
parity floor, not the native-exploit layer).
