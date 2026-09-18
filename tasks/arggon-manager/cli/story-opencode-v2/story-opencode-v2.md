---
type: story
status: todo
id: story-opencode-v2
title: Native OpenCode V2 integration
parent: cli
labels: []
created: "2026-09-17"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-opencode-v2/story-opencode-v2.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Native OpenCode V2 integration

## Context

ArggonManager should integrate natively with OpenCode V2, maximizing the
capabilities documented at `https://opencode.ai/v2/docs/` without forking its
rules or depending on OpenCode from the core CLI. The research spike
([exploration-opencode-v2-native-009](../../../../docs/explorations/exploration-opencode-v2-native-009.md),
task-opencode-v2-proposal) found:

- Two integrations already work implicitly: the bundled
  `.agents/skills/arggon-cli` + `arggon-upgrade` skills are auto-discovered by
  V2, and the generated `AGENTS.md` is V2's instruction mechanism.
- One concrete gap: V2 registers MCP servers under `mcp.servers` in
  `opencode.json(c)`; the generated `.mcp.json` is unverified for V2.
- The highest-value additions are a generated `.opencode/` seam (config only
  when the adopter has none, plus agents and commands), `doctor` integration
  checks, MCP session attribution, and an optional behavioral plugin
  (MCP auto-registration, bounded current-item context, compaction-safe
  re-injection).

Staged plan: **Phase 1** declarative seam (no new runtime deps) → **Phase 2**
optional plugin (behind ADR 0010) → **Phase 3** optional TUI plugin and, only
if demanded, SDK embedding as a separate ADR.

Rules remain in `cli/src/rules.ts`; the CLI and MCP surfaces must keep working
for non-OpenCode agents. Nothing in this story may introduce an OpenCode-only
workflow dialect.

## Acceptance

- [ ] ADR 0010 accepted: integration architecture (declarative seam + optional
      plugin, package vs vendored), version-pinning policy, and revisit trigger.
- [ ] Spec + plan for the generated `.opencode/` seam: config generation
      contract (only when the adopter has no config; never overwrite),
      agent/command templates, `x-generated` provenance, JSON validity, drift
      tests.
- [ ] `arggon init` generates the Phase 1 seam; re-runs skip/refresh per the
      existing never-overwrite semantics.
- [ ] `arggon doctor` reports OpenCode integration state: V1-shaped config
      detection (top-level `mcp.<name>`, `enabled`, `autoupdate`), artifact
      presence, native MCP registration status.
- [ ] MCP `_meta.sessionID` read for `arggon_comment` / `arggon_handoff`
      attribution defaults, additive-only schema, parity tests green.
- [ ] `docs/playbooks/opencode.md` (OpenCode 2.0.7) generated through the
      playbook pipeline; `docs/agents.md` §Reference integrations, README and
      `docs/json-output.md` updated as behavior lands.
- [ ] Optional plugin shipped with smoke evidence: MCP auto-registration,
      bounded current-item context injection, compaction-safe re-injection;
      plugin failure never blocks CLI/MCP use.
- [ ] No private dialect: rules stay in `cli/src/rules.ts`; CLI/MCP remain
      cross-agent (Claude Code, Codex, CI) with no OpenCode dependency.

## Notes

- Exploration:
  [exploration-opencode-v2-native-009](../../../../docs/explorations/exploration-opencode-v2-native-009.md).
- Anti-goals: duplicating the rule engine, relying on inert V2 surfaces
  (`instructions` config array, agent `request` overlays, session sharing),
  plugin worktree strategy in Phase 1 (`arggon start --worktree` stays
  authoritative).
- Update this checklist in the same PRs that land each item; do not pre-check.
