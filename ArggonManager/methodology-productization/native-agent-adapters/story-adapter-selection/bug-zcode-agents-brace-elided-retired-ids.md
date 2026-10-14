---
type: bug
status: in_progress
id: bug-zcode-agents-brace-elided-retired-ids
title: "docs/agents.md §ZCode brace-elides retired agent ids (arggon-{worker,reviewer}.md) and the id guard is substring-based, so it ships green"
assignee: arggon-delivery-lead
branch: fix/bug-zcode-agents-brace-elided-retired-ids
parent: story-adapter-selection
labels: [docs, tests, roles]
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T11:54:17.362Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-zcode-agents-brace-elided-retired-ids
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/bug-zcode-agents-brace-elided-retired-ids.md
  Leaves live only under a story. id is the filename stem: bug-zcode-agents-brace-elided-retired-ids.
  CLI `arggon create bug zcode-agents-brace-elided-retired-ids` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# docs/agents.md §ZCode brace-elides retired agent ids (arggon-{worker,reviewer}.md) and the id guard is substring-based, so it ships green

## Context

Found by the `task-zcode-maker-lesson-trigger` maker (PR #802): `ArggonManager/docs/agents.md` §ZCode names the retired agent ids **brace-elided** (`agents/arggon-{worker,reviewer}.md`), and the live-doc guard added by `bug-retired-agent-ids-in-doc-samples` (`cli/src/agent-id-doc-contract.test.ts`) is substring-based — the elided form matches neither the retired literals nor the shipped-id set, so it ships green. Third instance of the class (`bug-retired-agent-ids-in-doc-samples` caught `json-output.md`; `bug-adr-0021-s5-lists-retired-agent-ids` caught ADR 0021 §5).

## Acceptance

- [ ] `docs/agents.md` §ZCode names the shipped ZCode seam agents (verify against `templates/docs/zcode/arggon/agents/` and the plugin manifest — what actually ships)
- [ ] the id guard detects brace/elision forms, or the ids are enumerated so an elision cannot hide a retired id; a reverted negative control fails as designed
- [ ] grep evidence in the item; `arggon validate` + affected suites green; prettier clean on touched files

## Notes
