---
type: story
status: in_progress
id: story-item-comments
title: Comments on work items
assignee: Arggon
branch: feat/story-item-comments
parent: agent-coordination
labels: []
created: "2026-09-11"
updated: "2026-09-12"
claimed_at: "2026-09-12T00:31:28.399Z"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-item-comments/story-item-comments.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Comments on work items

## Context

Agent handoff needs a home: why an item is blocked, what the next agent should know. Timestamped comment sections appended to the item body keep diffs clean and stay markdown-native.

## Acceptance

- [ ] `arggon comment <id> "text"` appends a timestamped, author-attributed section; `--json` confirms
- [ ] Comments never touch frontmatter (body-only write path, tested)
