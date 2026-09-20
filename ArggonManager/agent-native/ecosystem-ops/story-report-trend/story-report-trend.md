---
type: story
status: done
id: story-report-trend
title: Git-history trend reporting
assignee: Arggon
branch: feat/story-report-trend
parent: ecosystem-ops
labels: []
created: "2026-09-11"
updated: "2026-09-12"
claimed_at: "2026-09-12T01:19:07.031Z"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-report-trend/story-report-trend.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Git-history trend reporting

## Context

Git history is a free analytics database: every transition is a frontmatter diff. Mining `git log --follow tasks/` yields cycle time, lead time and weekly burndown without any server.

## Acceptance

- [x] `arggon report --trend` renders weekly completion counts and average cycle time per item type
- [x] Pure read (git log only, no tree writes); `--json` series payload
