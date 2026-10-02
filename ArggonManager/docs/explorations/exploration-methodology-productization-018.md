---
exploration_id: methodology-productization-018
title: ArggonManager as a standalone methodology with per-agent adapters
status: open
created: 2026-10-02
---

# Exploration: ArggonManager as a standalone methodology with per-agent adapters (methodology-productization-018)

Spike record: the idea is to treat **ArggonManager itself as a methodology of
work** — Agile-grade, documentation-current, git-disciplined, applicable to
projects in general (not only software) — and to ship **per-agent adapters**
(plugins/skills/commands for OpenCode, ZCode, Claude Code, …) that make each
agent follow that methodology through its own native capabilities rather than
through one lowest-common-denominator seam. Compare the delivery candidates
below, cite dated sources, record a recommendation. The decision lands in an
ADR — link it under Decision.

## Ground truth (2026-10-02)

What the repo already is:

- **The methodology already exists, implicitly.** Its carriers are
  `ArggonManager/docs/agents.md` (work loop), `docs/engineering.md` (review bar,
  ADR/DoD), `docs/convention.md` (tracker schema), and the bundled
  `skills/arggon-cli/` skill. ADR 0011 declares "the methodology is the
  contract"; ADR 0016 defines how changes reach adopters; ADR 0017 gates
  greenfield work behind the six-phase exploration protocol. Nowhere is the
  methodology itself versioned, standalone, or marketed as the product.
- **One core, many seams.** Kernel (`lib/`), CLI, stdio MCP server — one logic
  path, rules enforced identically on every surface (`lib/src/rules.ts`).
- **OpenCode V2 native seam (shipped, ADR 0010/ADR 0011).** Generated
  `.opencode/agents/`, `.opencode/commands/arggon-*`, vendored single-file
  plugin (`.opencode/plugins/arggon/index.ts`) exposing native `arggon` tools,
  TUI board panel (`/arggon-board`, Ctrl+P), bounded item-context block on
  model calls, permissions on the coordinator/worker/reviewer agents,
  worktree domain integration, headless wave evidence harness.
- **ZCode native seam (shipped, ADR 0014).** Declarative plugin
  (`.zcode-plugin/plugin.json` + marketplace), agents/commands generated,
  hook gate (`hooks/gate.mjs`), MCP full 15-tool parity surface. No TUI panel
  (ZCode is a desktop ADE), no per-agent permission DSL (hooks substitute),
  no custom subagents in ZCode (reviewer backstop emulated by the hook).
- **Claude Code: no seam.** Only a generated root `CLAUDE.md` (`@AGENTS.md`)
  and the cross-agent `.agents/skills/arggon-cli/` copy. No plugin, no hooks,
  no generated agents/commands, no MCP wiring for Claude Code specifically.
- **Playbooks** (`docs/playbooks/`) cover node/typescript/vitest/opencode for
  stack execution, not agent-native methodology adaptation.

Capability survey (dated sources, accessed 2026-10-02):

| Agent            | Native capabilities ArggonManager could exploit                                                                                                                                                                                                                                                                                                   | Today in repo                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| OpenCode V2      | Plugin registry transforms (agent/provider/model/command/mcp/skill/vcs/worktree/integration/reference), session hooks (`prompt` admission, `context`/`compaction`/`generate`/`title`, `http.request/response`, retry), TUI-only CLI plugins/panels, event stream, Code Mode tools with namespaces, generated secrets/permissions, worktree domain | Partial: tools + TUI board + item-context block + permissions                                                 |
| ZCode (Z.ai ADE) | Goal mode (plan→execute→verify loop), automations (scheduled/queued recurring agent work), bot channels (phone control), plugin marketplace (skills/commands/MCP/hooks), parallel tasks, permission modes, `@` context, `/` commands                                                                                                              | Partial: marketplace plugin, agents/commands, hook gate, MCP parity. **Goal mode + automations unexploited.** |
| Claude Code      | Plugin bundles (skills + subagents + hooks + MCP + commands), plugin marketplaces, hook events (PreToolUse/PostToolUse/Stop), subagent permissions, `CLAUDE.md`/settings.json                                                                                                                                                                     | Minimal: root `CLAUDE.md` pointer + shared skill copy                                                         |

Sources: opencode.ai/v2/docs/plugins + /build/plugins (2026-10-02);
flaviocopes.com/zcode (2026-08-31) and composio.dev ZCode guide (2026);
Claude Code plugin/hooks docs (2026), AgentSkills spec portability (AGENTS.md).

## Problem statement

1. The methodology is real but **implicit** — buried in long docs, unversioned
   as a product, with no machine-readable statement of rules. Adopters get
   docs, not a methodology.
2. Adapter quality is **uneven**: OpenCode and ZCode have seams; Claude Code
   has none. Each agent's distinctive capabilities (OpenCode TUI/hooks, ZCode
   goal mode/automations, Claude Code plugins/marketplace) are only partially
   mapped to methodology enforcement.
3. "Not only software projects" is unmet: the tracker/docs model is generic,
   but nothing validates the methodology as domain-neutral, and no adapter
   story covers non-coding work (research, ops, writing).

## Candidates

### C1 — Methodology-as-product, all in this monorepo (recommended)

Formalize the methodology inside the existing repo instead of forking it out:

1. **Methodology carriers, promoted to the product surface.** Declare
   `agents.md` / `engineering.md` / `convention.md` + the skill as
   _the ArggonManager methodology_, versioned with the package, with an
   explicit statement of scope (general projects, not only software) and
   invariants (same rules for humans and agents, state in git, docs travel
   with code, enforceable discipline).
2. **Per-agent adapters** under one directory (e.g. `adapters/<agent>/`), each
   declaring how it maps the methodology onto that agent's native features:
   OpenCode V2 (plugins, hooks, TUI panels, permissions, worktrees), ZCode
   (plugin marketplace, hooks, goal mode, automations), Claude Code (plugin
   bundle: skills/agents/hooks/commands/MCP + marketplace).
3. **A capability matrix** (machine-readable, report-only in `doctor`):
   methodology invariant × agent → native mechanism or explicit gap.
4. CLI/`init` gains adapter selection (`arggon init --agents opencode,zcode,claude`).

Trade-offs: single source of truth stays here (no fork); bigger package;
adapter surface must be CI-smoked per agent.

### C2 — Extract a standalone `@arggondev/methodology` package

Ship the methodology as its own npm package (rules text + manifest + maybe a
rules engine), consumed by this CLI and by third-party adapters. Cleanest
"methodology as its own product"; highest cost: publishing, version skew
between methodology and kernel, and a new package to maintain. Premature until
adapter volume justifies it — record as a future option.

### C3 — Status quo, extended

Keep adding seams per agent without naming/versioning the methodology. Lowest
effort; fails the core of the idea (the methodology stays invisible) and makes
the Claude Code gap perpetual.

## Criteria

Weighted, highest first.

1. **Methodology clarity** — a newcomer can state what ArggonManager is in one
   paragraph and find the authoritative carriers in one hop.
2. **Native exploit depth** — each adapter uses its agent's distinctive
   mechanisms (ZCode goal mode/automations, OpenCode hooks/TUI, Claude Code
   plugins) rather than falling back to MCP-only parity.
3. **One logic path preserved** — no adapter forks kernel rules; every
   enforcement mechanism delegates to `lib/src/rules.ts`.
4. **Adopter blast radius** — all changes additive (new `init` flags, new
   generated files behind never-overwrite); no breakage of existing seams.
5. **Domain neutrality** — artifacts must read sanely for non-software work
   (docs, research, ops) — checklist: no software-only assumption in
   methodology carriers.
6. **Verifiability** — each adapter ships a smoke story (headless run,
   hook probe, marketplace install) before merge; `doctor` reports coverage.

## Edge-case hunt (pre-seeded)

| Dimension  | Hunted case                                                                            | Resolution                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Divergence | Adapter blesses a rule the kernel forbids (e.g. a UI action that skips the claim gate) | **Spec AC**: no adapter may mutate tracker state except through kernel/MCP/native tools whose envelopes match the CLI                                           |
| Divergence | ZCode goal mode loops on an agent-owned item while a worker has it claimed             | **Spec AC**: adapters must honor claim leases; goal/automation prompts check `arggon list --stale`/assignee before dispatch; never-steal holds                  |
| Coupling   | OpenCode seam bytes stale after a release (known bug class)                            | **Spec AC**: `doctor` version-reports adapter bundles; refresh instructions in release notes                                                                    |
| Coupling   | Claude Code plugin unavailable (air-gapped adopter)                                    | **Non-goal guard**: methodology works with docs+CLI alone; adapters are enhancers                                                                               |
| Scope      | Methodology carriers grow unreadable                                                   | Existing C5 from exploration-014 stands: context budget for carriers                                                                                            |
| Domain     | "Not only software" breaks software-shaped templates (PR gates, branch patterns)       | **Spike item**: branch/PR model evaluated for non-code repos; convention already generic (markdown items); note as acceptance criterion to verify, not redesign |
| Security   | Hook fail-open posture (zcode gate) vs methodology "enforceable discipline"            | Keep kernel as enforcement; hooks stay defense-in-depth; document explicitly in matrix                                                                          |
| Ops        | ZCode automations scheduling agent work overnight                                      | Gate behind explicit opt-in template; automations carry the claim/branch preconditions                                                                          |
| Upgrade    | Claude Code/OpenCode/ZCode release cadence drifts from our carriers                    | `playbook status`-style staleness for adapter versions via ADR 0018 update channel                                                                              |

## Decision

Pending — this exploration feeds ADR 0020 (to be created): adopt **C1**
(methodology-as-product inside this monorepo), with **C2 recorded as a future
option** and **C3 rejected**.

The decision decomposes into: formalizing the carriers (advisory methodology
edit), the per-agent adapter spec (`spec-methodology-adapters-017`), and the
plan that files adapter tasks per agent.
