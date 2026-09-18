---
type: task
status: in_progress
id: task-opencode-v2-proposal
title: Research native OpenCode V2 integration
assignee: Arggon
branch: feat/task-opencode-v2-proposal
parent: story-opencode-v2
labels: []
created: "2026-09-17"
updated: "2026-09-18"
claimed_at: "2026-09-17T20:20:06.249Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-opencode-v2/task-opencode-v2-proposal.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-proposal.
  CLI `arggon create task opencode-v2-proposal` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Research native OpenCode V2 integration

## Context

The product owner asked for a deep investigation of how to integrate
ArggonManager natively into OpenCode V2, maximizing every capability described
in the V2 documentation (https://opencode.ai/v2/docs/). The deliverable is a
reviewable exploration with dated sources, candidate comparison, a
recommendation, and actionable follow-ups filed under
[story-opencode-v2](./story-opencode-v2.md) — not an implementation.

Starting point verified before the research: the repo has no `.opencode/`
artifacts and no `opencode.json(c)`; `arggon init` already bundles
`arggon-cli` + `arggon-upgrade` under `.agents/skills/` (auto-discovered by
V2) and generates a Claude-style `.mcp.json` whose V2 reachability is
unverified. Local OpenCode version: v2.0.7.

## Acceptance

- [x] V2 documentation surveyed per capability from
      `https://opencode.ai/v2/docs/` only (V1 docs excluded), with dated source
      links per claim.
- [x] Candidates compared against the repo's non-negotiables (tracker as source
      of truth, rules in `cli/src/rules.ts`, no OpenCode hard dependency,
      minimal deps, never-overwrite/provenance) with weighted criteria.
- [x] Gaps identified with local evidence (`.mcp.json` vs `mcp.servers`,
      missing `.opencode/` seam, no V2-native commands/agents) and inert V2
      surfaces documented so nothing is built on them.
- [x] Recommendation written as staged phases (declarative seam → optional
      plugin → optional TUI/SDK) with an explicit decision pending ADR 0010.
- [x] Follow-up work filed as `task` items under
      [story-opencode-v2](./story-opencode-v2.md), each with context and an
      acceptance checklist.

## Notes

**Deliverable:**
[docs/explorations/exploration-opencode-v2-native-009.md](../../../../docs/explorations/exploration-opencode-v2-native-009.md)
(candidates A–D, criteria, capability findings, inert-surface table, risk
register, staged recommendation).

**Headline findings:**

1. **Already native (no work):** `.agents/skills/arggon-cli` and
   `.agents/skills/arggon-upgrade` are discovered by V2 automatically; the
   generated `AGENTS.md` is V2's instruction mechanism (V2 ignores `CLAUDE.md`
   as a fallback); ACP clients inherit both.
2. **Concrete gap:** V2 registers MCP servers under `mcp.servers` in
   `opencode.json(c)`; the V2 docs do not mention `.mcp.json`, so the generated
   file is unverified for V2. Phase 1 adds a native registration; Phase 2 can
   auto-register from the plugin.
3. **Highest-value native additions:** generated `.opencode/` agents
   (coordinator / worker / reviewer with permission-encoded review bar) and
   commands (`/arggon-next`, `/arggon-claim`, …); `doctor` OpenCode checks;
   MCP `_meta.sessionID` attribution; optional plugin for bounded current-item
   context injection and compaction-safe re-injection.
4. **Anti-goals:** no rule duplication in the plugin, no OpenCode dependency in
   the core CLI, no reliance on inert V2 surfaces (`instructions` config,
   agent `request` overlays, session sharing).
5. **Reverse embedding** (`@opencode/sdk` inside the CLI) is documented as
   candidate D and rejected as a first step (new top-level package, inverted
   dependency); revisit only with a dedicated ADR.

**Follow-ups filed:** ADR, config-spec, doctor, MCP attribution, docs/playbook,
and the optional plugin (see the story's children). Nothing in this task
implements them.

### handoff 2026-09-18 @Arggon — next: Push feat/task-opencode-v2-proposal and open the PR; auto-done flips this item after merge. Follow-ups filed under story-opencode-v2.
- branch: feat/task-opencode-v2-proposal
- open questions: ADR 0010 packaging choice (published plugin vs vendored template) stays open by design.
