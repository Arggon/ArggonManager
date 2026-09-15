---
type: task
status: done
id: task-skill-sync-feature-wave
title: "SKILL sync: surface show, handoff, 9-tool MCP list and recent features in the bundled skill"
assignee: Arggon
branch: feat/task-skill-sync-feature-wave
parent: story-init-docs
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-skill-sync-feature-wave.md
  Leaves live only under a story. id is the filename stem: task-skill-sync-feature-wave.
  CLI `arggon create task skill-sync-feature-wave` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# SKILL sync: surface show, handoff, 9-tool MCP list and recent features in the bundled skill

## Context

Content audit (2026-09-15, coordinator) of skills/arggon-cli/SKILL.md against the current feature set found 4 gaps. Root cause: several feature PRs (show #197, handoff #234, mcp-parity #237, next-pool #243, issue-roundtrip #228) updated README/json-output/docs/agents.md but left the SKILL untouched — in part because wave coordination scopes excluded skills/. The SKILL is what agents read BY DEFAULT, so agent-facing features must sync it in the same PR (docs-travel-with-code applies to it with priority).

Gaps (code-verified against skills/arggon-cli/SKILL.md):
1. MCP tool list stale: says "arggon_list/_create/_update/_comment" — the server now exposes 9 tools (list/create/update/comment/show/handoff/next/report/validate).
2. `arggon show` — 0 mentions: ADR 0006's bounded single-item read path is invisible to skill-following agents.
3. `arggon handoff <id>` — 0 mentions as a command (only the generic "handoff" concept): the structured resume note is invisible.
4. Minor: `spec analyze`, issue round-trip (x-github), `--include-stories` — 0 mentions.

## Acceptance

- [x] SKILL.md MCP line lists the 9 tools (or drift-proof phrasing pointing at docs/agents.md §MCP for the live list)
- [x] SKILL.md gains: `arggon show <id> --json` (bounded single-item read — prefer it over raw file reads) and `arggon handoff <id> --next "..."` (structured resume at session end) in the command/guidance sections
- [x] SKILL.md one-liners: `arggon spec analyze` (report-only quality pass) in §4; issue round-trip (x-github, opt-in) in the import/GitHub guidance; --include-stories note in the next guidance
- [x] .agents copy regenerated via `npm run skills:sync` (gitignored, parity test covers); doctor 0 modified / 0 drifted; generated AGENTS.md untouched (budget)
- [x] Standing rule noted in the item: agent-facing features MUST sync SKILL.md in the same PR — reviewers reject otherwise

## Notes

Standing rule (coordinator, 2026-09-15): agent-facing features MUST sync
skills/arggon-cli/SKILL.md in the same PR as the feature — reviewers reject
feature PRs that leave the SKILL stale (docs-travel-with-code applies to the
SKILL with priority, since it is what agents read by default).

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. All four audit gaps closed with wording verified against live --help (no invented flags), the 9-tool MCP line replaces the stale 4-tool list, and the standing rule is now recorded in the item: agent-facing features sync the SKILL in the same PR or the review rejects it. The quality-bar clause folding show/handoff/comment guidance into one place is tight. Merge follows.
