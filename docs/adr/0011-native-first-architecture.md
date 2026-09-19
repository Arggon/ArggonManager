# 0011 Native-first architecture: OpenCode-native surface over a git-native tracker

- Status: Proposed
- Date: 2026-09-19
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Research: [exploration-opencode2-native-010](../explorations/exploration-opencode2-native-010.md) (task-native-capability-audit)
- Supersedes (partially): [ADR 0010](0010-opencode2-native-architecture.md) §2/§3 and its packaging deferrals (native tools, in-process kernel, npm publishing)
- Program: `task-native-spec-plan` (spec + wave plan under `native-redesign`)

## Context

Product-owner directive (2026-09-19): the `opencode2` branch exists to build
something **exclusive to OpenCode V2, as native as possible** — rewriting
everything if needed and discarding the CLI and/or MCP. The audit
([exploration 010](../explorations/exploration-opencode2-native-010.md),
2026-09-19) inventoried every V2 surface and recommended candidate B
(native-first hybrid). The product owner delegated D1 (source of truth) and D2
(methodology contract) to that audit:

- **D1**: git-native `tasks/` stays canonical; runtime storage is a cache.
- **D2**: the methodology stays the contract; the mechanics are redesigned with
  native primitives.

ADR 0010 chose "portable core unchanged + thin native surface" and deferred
native plugin tools, the in-process kernel and npm publishing. Those deferrals
and the CLI/MCP-first stance are superseded here; the portable **data** contract
and the **one logic path** rule remain.

## Decision

1. **Native-first surface is the product.** In-process `arggon` tools
   (`ctx.tool.transform`, namespaced, `codemode: true`) call the shared kernel;
   native commands and agents drive the workflow; `ctx.permission.rules` and
   agent policies enforce hard gates; item worktrees use the worktree domain;
   board/status surfaces are TUI plugin routes/slots/panels; context and
   hygiene stay on session hooks and events.
2. **Git-native `tasks/` is the single source of truth.** Runtime storage is
   cache for session correlation only; CI, diffs and review of work items stay
   in git.
3. **The methodology is the contract.** Agile tree, statuses, the claim
   invariant, claim → worktree → PR → review → merge → done, and the
   methodology doc pipeline are unchanged; only the mechanics become native.
4. **One logic path, one library.** The kernel is extracted as a library
   consumed by the plugin and, where they survive, by adapters. Rules never
   fork.
5. **Distribution.** A single npm package ships kernel + plugin + a thin
   headless bin. `init` remains the seam generator; the headless surface keeps
   `--json` for CI. MCP is dropped from the default path (a conditional adapter
   only if non-OpenCode clients return).
6. **Config seam.** The generated `opencode.jsonc` stops writing the MCP
   stanza; it keeps formatter/compaction and, if needed, permission defaults.
7. **Version policy.** Pin OpenCode 2.0.10 (playbook refresh filed as
   `task-playbook-opencode-2-0-10`), feature-detect optional surfaces, keep
   every path failure-isolated, and re-measure ADR 0006 budgets as the gate of
   the native-tools wave.
8. **Migration.** `init` provenance semantics upgrade existing adopters; the
   tracker convention and data are untouched.

**Bootstrap tension (resolved for now).** A plugin cannot create the repo it
lives in, and CI has no model: candidate B keeps a thin headless artifact for
bootstrap + CI. Moving from B to A (drop the CLI/MCP entirely) requires a
bootstrap that works without the artifact and a CI adapter independent of it;
that is the explicit revisit trigger.

## Consequences

- **Positive**: first-class use of V2 primitives; no subprocess bridge; typed
  in-process calls; permission integration and Code Mode exposure; the git data
  contract keeps CI and migration simple.
- **Negative / accepted**: a bigger in-process surface (failure isolation
  becomes critical), increased exposure to 2.0.x API churn, npm packaging and
  CI burden, and a testing program that must grow headless coverage for native
  tools, commands and permissions. Non-OpenCode clients lose first-class
  support by decision.
- **Neutral**: the tracker format and methodology docs are unchanged; ADR 0010
  remains valid where it is not superseded.

## Alternatives considered

- **A — native monolith** (drop CLI, MCP and the headless artifact). Rejected
  for now: the bootstrap paradox and model-less CI; it is the end-state once
  the revisit trigger is met.
- **C — runtime-state tracker** (`ctx.storage`/DB as source of truth).
  Rejected: no diffs/review/blame, no CI without a model, couples the
  tracker's lifetime to the editor.
- **D — status quo (ADR 0010)**. Rejected: superseded by the directive.
- **MCP-primary, SDK embedding, plugin-without-kernel**: rejected in the audit
  (no native gain; inverts the dependency; forks logic).
