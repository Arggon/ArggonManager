---
type: task
status: in_progress
id: task-publish-canonical-agent-workflow
title: Publish canonical agent workflow
assignee: arggon-superagent
branch: agent/canonical-agent-workflow-281c0949f690
parent: story-docs-sync
labels: []
created: "2026-11-03"
updated: "2026-11-03"
claimed_at: "2026-11-03T22:21:18.552Z"
worktree_path: /home/arggon/.dsh/state/superagent/work/canonical-agent-workflow-281c0949f690
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-docs-sync/task-publish-canonical-agent-workflow.md
  Leaves live only under a story. id is the filename stem: task-publish-canonical-agent-workflow.
  CLI `arggon create task publish-canonical-agent-workflow` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Publish canonical agent workflow

## Context

Issue #869 identifies contradictory claim and completion instructions in the playbook, adopter templates and CLI skill. Publish a normative role-aware contract and generate the entrypoint excerpts from it. Source: https://github.com/Arggon/ArggonManager/issues/869.

## Acceptance

- [ ] Identify one normative contract for agent worktree claims, delegated makers, single-checkout humans and post-merge completion.
- [ ] Generate the copy-paste snippet, adopter agent workflow and skill quickstart; replace contradictory summaries with pointers.
- [ ] Add consistency and check-only drift gates in CI, with regression tests for the old instructions.
- [ ] Validate the instructions command and generated adopter surfaces.

## Notes
