---
type: task
status: in_progress
id: task-publish-canonical-agent-workflow
title: Publish one canonical agent workflow contract and generate its copies
assignee: arggon-superagent
branch: agent/single-agent-workflow-fe86b2bdf75c
parent: story-docs-sync
labels: []
created: "2026-11-04"
updated: "2026-11-04"
claimed_at: "2026-11-04T20:37:46.389Z"
issue: 869
worktree_path: /home/arggon/.dsh/state/superagent/work/single-agent-workflow-fe86b2bdf75c
---
## Context

Issue #869 (methodology review, part 2 of 5): the agent-facing surfaces disagree on how to claim and when an item is done, and nothing states the human single-checkout boundary. After #873 the operational core lives in `ArggonManager/docs/agents.md`; this item publishes the normative claim/completion contract there and generates its copies, so the surfaces cannot drift again.

Source: https://github.com/Arggon/ArggonManager/issues/869

## Acceptance

- [x] `ArggonManager/docs/agents.md` names one normative workflow contract covering the agent worktree claim, the delegated maker, the single-checkout human path and post-merge completion.
- [x] The `arggon instructions` copy-paste snippet, the adopter AGENTS/CONTRIBUTING/copilot templates and the bundled skill are generated from or link to that contract.
- [x] Root entrypoints (`AGENTS.md`, `CONTRIBUTING.md`, `.github/copilot-instructions.md`) no longer teach a bare agent claim or pre-merge completion.
- [x] A check-only drift command and a test fail on stale copies and on the old phrasing, and CI runs the drift check.
- [ ] Verification: workflow/instructions/init-docs tests, lint, `arggon validate` and the context-budget check pass.

## Notes

### 2026-11-04 @arggon-superagent
**Methodology impact class: Behavioral (ADR 0016, adopter upgrade channel).** `ArggonManager/docs/agents.md` §2 is now the normative claim/completion contract: agents claim through `start --worktree`, delegated makers confirm the handed-off claim, the single-checkout human `update` + `branch` path is explicit and not an agent fallback, and `done` requires the merged PR with the delivery lead (or `auto-done`) flipping it. Maintainers must run `npm run workflow:sync` after editing the contract; `npm run workflow:check` is a new CI step that fails on stale copies and never rewrites them. The adopter AGENTS/CONTRIBUTING/copilot templates, the generated copilot copy and the adapter `start` commands now link to or enforce that contract.
