---
type: task
status: done
id: task-opencode-v2-adr
title: "ADR 0010: OpenCode V2 integration architecture"
assignee: Arggon
branch: opencode2
parent: story-opencode-v2
labels: []
priority: p1
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode-v2-adr.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-adr.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0010: OpenCode V2 integration architecture

## Context

W0 of the OpenCode2 program. The research
([exploration-opencode-v2-native-009](../../../docs/explorations/exploration-opencode-v2-native-009.md))
established the V2 capability map; the product owner chose the complete-refactor
direction and the `opencode2` integration branch. This task owns the
architecture decision and ships its draft in the same W0 commit as the program
plan, because a plan cannot point at a decision that does not exist yet.

## Acceptance

- [x] `docs/adr/0010-opencode2-native-architecture.md` written with the
      documented minimum structure (Context, Decision, Consequences,
      Alternatives considered); status **Proposed**.
- [x] Research section links the exploration; program section links
      [spec-opencode2-009](../../../docs/specs/spec-opencode2-009.md) and
      [plan-opencode2-009](../../../docs/plans/plan-opencode2-009.md).
- [x] Decides, with rationale: two layers (portable core + generated native V2
      surface); ambient-behavior-only plugin with MCP as the tool surface;
      one logic path through the kernel; vendored-plugin packaging with
      version pinning, feature detection and graceful degradation; waves
      W0–W7.
- [x] Alternatives documented: status quo, MCP-only, native plugin tools,
      npm-published plugin, in-process kernel import, SDK embedding,
      plugin-only rewrite.
- [x] Non-goals stated: no rules outside `cli/src/rules.ts`, no OpenCode
      dependency in the core, no reliance on inert V2 surfaces.
- [x] Status flips `Proposed` → `Accepted` on merge of the ADR (W0/W1 PR).

## Notes

- The ADR is intentionally scoped to architecture; per-wave specs (starting
  with the seam spec, task-opencode-v2-spec) carry the feature contracts.
- If a later wave disproves a decision (e.g. MCP limitation), supersede this
  ADR with a new one instead of rewriting it.

### handoff 2026-09-18 @Arggon — next: ADR 0010 is written (Proposed) on branch opencode2; flip to Accepted when the W0/W1 PR is reviewed and merged.
- branch: opencode2
- open questions: Vendored plugin vs npm package stays deferred per ADR; revisit trigger recorded.
