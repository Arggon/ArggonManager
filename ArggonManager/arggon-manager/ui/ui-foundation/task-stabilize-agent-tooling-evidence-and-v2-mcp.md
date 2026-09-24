---
type: task
status: in_progress
id: task-stabilize-agent-tooling-evidence-and-v2-mcp
title: Stabilize agent-tooling evidence and qualify Playwright MCP V2 setup
assignee: Arggon
parent: ui-foundation
labels: [research, agents, tooling, review-followup]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
claimed_at: "2026-09-24T15:13:04.535Z"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-stabilize-agent-tooling-evidence-and-v2-mcp.md
  Leaves live only under a story. id is the filename stem: task-stabilize-agent-tooling-evidence-and-v2-mcp.
  CLI `arggon create task stabilize-agent-tooling-evidence-and-v2-mcp` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Stabilize agent-tooling evidence and qualify Playwright MCP V2 setup

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-24 @Arggon
## Context

This follow-up consolidates the two merge-blocking findings from the provisional lead-architect review of [PR #416](https://github.com/Arggon/ArggonManager/pull/416); the verdict is recorded in the [research item's reviewer comment](task-evaluate-open-source-agent-tooling-for-arggonmanager.md) (2026-09-24 @Arggon-reviewer).

1. **Context-budget evidence:** exact `doctor --budget` `generatedAgentsMdBytes` and `showBytes` values vary because the throwaway project name is derived from a temporary path/PID. The exploration now reports the observed 2,020–2,021 B / 768–769 B range and preserves the stable under-budget/schema conclusion.
2. **OpenCode V2 MCP setup:** the published `@playwright/mcp@0.0.82` OpenCode snippet uses legacy-shaped `mcp`/`enabled`. The exploration now requires translation and registration verification against the current V2 `mcp.servers`/`disabled` schema before any fallback pilot, while keeping the tool opt-in and secondary.

## Acceptance

- [x] Re-measure the volatile budget fields and qualify the exploration and current tracker evidence without rewriting historical comments.
- [x] Qualify the `@playwright/mcp` recommendation and record the V2 translation/registration gate and opt-in boundary.
- [x] Run focused prose, tracker, and spec validation; introduce no ADR, runtime dependency, generated config, or product behavior change.
- [ ] Coordinator reviews/merges PR #416 and completes this follow-up after merge.
