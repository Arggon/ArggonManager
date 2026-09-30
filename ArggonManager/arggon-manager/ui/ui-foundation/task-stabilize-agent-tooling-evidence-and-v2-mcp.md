---
type: task
status: done
id: task-stabilize-agent-tooling-evidence-and-v2-mcp
title: Stabilize agent-tooling evidence and qualify Playwright MCP V2 setup
assignee: Arggon
parent: ui-foundation
labels: [research, agents, tooling, review-followup]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-stabilize-agent-tooling-evidence-and-v2-mcp.md
  Leaves live only under a story. id is the filename stem: task-stabilize-agent-tooling-evidence-and-v2-mcp.
  CLI `arggon create task stabilize-agent-tooling-evidence-and-v2-mcp` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Stabilize agent-tooling evidence and qualify Playwright MCP V2 setup

## Context

This follow-up consolidates the two merge-blocking findings from the provisional
lead-architect review of [PR #416](https://github.com/Arggon/ArggonManager/pull/416).
The reviewer verdict remains in the [research item's history](task-evaluate-open-source-agent-tooling-for-arggonmanager.md).

- **Context-budget evidence:** exact `doctor --budget` generated-`AGENTS.md` and
  `show` bytes vary with the throwaway path/PID; report a qualified range and
  preserve the stable budget/schema conclusion.
- **OpenCode V2 MCP setup:** the published `@playwright/mcp` snippet is
  legacy-shaped `mcp`/`enabled`; require current V2 `mcp.servers`/`disabled`
  translation and registration verification before any opt-in fallback pilot.

## Acceptance

- [x] Re-measure the volatile budget fields and qualify the exploration and current tracker evidence without rewriting historical comments.
- [x] Qualify the `@playwright/mcp` recommendation and record the V2 translation/registration gate and opt-in boundary.
- [x] Run focused prose, tracker, and spec validation; introduce no ADR, runtime dependency, generated config, or product behavior change.
- [x] Coordinator reviews/merges PR #416 and completes this follow-up after merge.

## Notes

### 2026-09-24 @Arggon — review-resolution evidence

The dated resolution evidence is retained here without duplicating the canonical
Context/Acceptance sections:

- Five default-temp-root `doctor --budget --json` runs returned generated
  `AGENTS.md` **2,021 B** and `show` **769 B**; an earlier run returned
  **2,020 B / 768 B**. Alternate temp roots returned `show` values of
  **778 B / 784 B / 824 B**, confirming that exact temporary-context bytes are
  process/path-qualified. `AGENTS.md` remains below **2,048 B**; `show` remains
  bounded; MCP remains **10,507 B / ~2,627 tokens** below its **12,288 B**
  advisory budget.
- The published `@playwright/mcp@0.0.82` OpenCode snippet uses legacy-shaped
  `mcp`/`enabled`; the exploration now requires translation and registration
  verification against current V2 `mcp.servers`/`disabled`, with the fallback
  opt-in and secondary.
- Focused prose, tracker, and spec validation passed. No ADR, runtime dependency,
  generated configuration, or product behavior change was introduced.

### handoff 2026-09-24 @Arggon (session: ses_f2c22e8bfffefNl32ha3H7kKPn) — next: Coordinator reviews/merges PR #416 after the two review findings are verified; leave this follow-up in_progress for post-merge completion.

- branch: research/agent-tooling-2026-09-24
- open questions: Shell-task pilot still needs a supported V2 beta runtime; Chromium waits for a fixed release and real E2E; native create was unavailable in this session, so sanctioned CLI create plus native update w…

### 2026-09-24 @Arggon-coordinator

## Coordinator final review verdict — PR #416

**APPROVE / merge after CI is green.** The provisional no-merge findings are resolved: volatile `doctor --budget` byte counts are explicitly qualified as process/path-dependent with bounded observations, and the legacy-shaped `@playwright/mcp` snippet is no longer presented as V2-ready; current V2 `mcp.servers`/`disabled` translation plus registration verification is required before any opt-in secondary pilot.

The canonical follow-up Context/Acceptance body is complete and `git diff --check` is clean. Architecture/boundaries, scope, conventions, quality/security/scalability, docs-with-code, and acceptance honesty pass the engineering review bar.

This is docs/tracker-only, so the blocking UI/TUI smoke exemption is valid. CI `cli`, `tasks-validate`, and `ui-smoke` are green at final head; local test, lint, build, `check:plugin`, `validate`, `spec`, and prose evidence is also green.

No runtime dependency, generated config, product behavior, or tracker source-of-truth change was introduced. The original research item remains `in_progress` because its future pilot/ADR checkbox is conditional and the pilot has not run. The actionable follow-up may be completed by the coordinator immediately after merge. No item is marked done by this verdict.
