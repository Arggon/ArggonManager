---
spec_id: methodology-adapters-017
title: Methodology-first productization + per-agent native adapters
status: proposed
created: "2026-10-02"
---

# Spec: Methodology-first productization + per-agent native adapters (methodology-adapters-017)

Decision record: [ADR 0020](../adr/0020-methodology-first-productization.md).
Spike record: [exploration-methodology-productization-018](../explorations/exploration-methodology-productization-018.md).

## Purpose

Make the ArggonManager methodology a first-class, versioned product surface —
adoptable by general (not only software) projects — and make each supported
agent follow it through that agent's native capabilities, without forking the
rule logic.

## Synopsis

The methodology becomes a versioned product surface, and each supported agent
reads it through that agent's own capabilities — with the rule logic living in
exactly one place.

```text
ArggonManager methodology (docs/ + CLI)      the product: any project, one rule set
  └─ adapter per client                       opencode (native tools, today)
                                               zcode, others (declarative plugin)
  ├─ carriers declare it                       scope + invariants + version + upgrade channel
  ├─ init --agents <list>                      installs the chosen adapters, provenance-stamped
  ├─ capability matrix                         what each client can and cannot enforce natively
  └─ never-overwrite                           adopter-edited adapter files are skipped, not clobbered
```

Three things make this a product rather than a feature: the carriers declare
scope and version so an adopter can tell what they are running; adapter
selection happens once, at `init`; and every capability the methodology assumes
is declared per client, with the kernel named as the enforcement of record
wherever a client hook is only defense-in-depth. Nothing in the chain is
required — `docs/` plus the CLI remain a complete methodology, and an absent or
failing adapter degrades to that.

## Invariants

- **One logic path.** Every adapter mutation of tracker state goes through
  the kernel (`lib/`), the CLI, or the MCP server — envelopes identical to
  the CLI contract. No adapter process keeps its own copy of a rule.
- **Same rules for humans and agents.** Human docs and agent seams never
  diverge: adapters enforce the same never-steal / never-reopen /
  claim-before-done invariants the kernel enforces.
- **Never overwrites.** Generated adapter files carry provenance and are
  skipped (never clobbered) once adopter-edited, per the init semantics.
- **Adapters are enhancers.** `docs/` + CLI alone remain a complete
  methodology; an absent or failing adapter never bricks the workflow.
- **Hook fail-open documented.** Client hooks (like the ZCode gate) are
  defense-in-depth; the kernel is the enforcement of record and the
  capability matrix says so.

## Surfaces

### S1 — Methodology carriers (the product doc)

- `ArggonManager/docs/agents.md`, `docs/engineering.md`,
  `docs/convention.md` and `skills/arggon-cli/` gain an explicit header
  block declaring them the ArggonManager methodology: scope (any project),
  invariants (listed in ADR 0020), version (tracks the package), and the
  adopter-upgrade channel reference (ADR 0016).
- `README.md` gains a "The methodology" section pointing at the carriers
  and the adapter matrix.

### S2 — Adapter selection at init

- `arggon init --agents <list>` (comma-separated: `opencode`, `zcode`,
  `claude`) selects which adapters materialize. Default: every detected
  agent. `--no-agents` suppresses adapter generation (docs+CLI only).
- `arggon doctor --agents` reports, per agent: adapter files present /
  stale / adopter-edited, and the matching methodology-mechanism row from
  the capability matrix.

### S3 — Capability matrix (machine-readable, report-only)

- A committed manifest (e.g. `adapters/capability-matrix.json`): rows of
  methodology invariant × agent → `mechanism` (native feature used:
  e.g. `opencode:session.hook("context")`, `zcode:goal-mode`,
  `claude:plugin.hooks.PreToolUse`), `package`, and `gap: true|false` with a
  note for every gap. `arggon doctor` prints the gap rows; `arggon sync`
  stays report-only about them. Never blocking in CI at v1.

### S4 — OpenCode V2 adapter expansion

- Session `context` hook injects the active work-item block (already
  bounded); add a `prompt` hook that stamps branch/item metadata on
  admission; keep compaction hook preserving the item block.
- TUI panel stays `/arggon-board`; add panel freshness from the event
  stream (`ctx.event.subscribe`) instead of polling.
- Permission rules for coordinator/worker/reviewer agents remain generated
  from the same matrix row.

### S5 — ZCode adapter expansion

- New generated **goal-mode template**: a Goal Mode objective + verification
  contract derived from the item's acceptance checklist (one goal per
  claimed item; never across worktrees).
- New **automation templates** (opt-in): daily spec-drift scan, weekly
  stale-claim sweep — each carrying the claim/branch preconditions and
  running read-only or filing items, never silently mutating.
- Reviewer backstop and git gates unchanged; capability matrix documents
  their fail-open posture.

### S6 — Claude Code adapter (follow-on story)

- A plugin bundle under `adapters/claude/` with: skills (arggon-cli
  pointer), agents (coordinator/worker/reviewer), hooks (gate equivalent),
  commands (`/arggon-*`), MCP wiring for `arggon mcp`. Marketplace manifest
  mirroring the ZCode shape. Same bar: parity with the kernel, generated
  with provenance, smoke-tested headless.

## Acceptance

- [ ] README + carriers declare the methodology (scope/invariants/version/
      upgrade channel); a fresh adopter can find it from `README.md` in one hop
- [ ] `arggon init --agents opencode,zcode --no-agents` matrix tested: each
      combination generates exactly the selected adapter, never overwrites
      adopter edits, and `--json` reports what was written/skipped
- [ ] `arggon doctor --agents` prints present/stale/adopter-edited per
      adapter file and lists matrix gap rows
- [ ] Capability matrix committed, valid JSON, one row per
      invariant × supported agent, every gap carrying a note
- [ ] OpenCode adapter: prompt-admission stamp + event-driven board panel
      smoke-tested headless (expected vs observed in the PR verdict)
- [ ] ZCode adapter: goal-mode template derives the objective from the item
      acceptance checklist; automation templates run read-only scans and
      file items via `arggon create`; unit-tested hook/gate contract stays
      green
- [ ] Claude Code story filed (not implemented in this spec's first wave)
- [ ] `arggon validate`, full test suite, lint, and `spec analyze` green

## Non-goals (v1)

- Standalone methodology package/repo (ADR 0020 C2 deferred).
- Adapter for Cursor/Codex/Gemini — recorded as matrix `gap` rows.
- Blocking CI gates on adapter freshness (report-only first, per ADR 0016
  spirit).
- Methodology carriers' context-budget overhaul (already tracked from
  exploration-014).
