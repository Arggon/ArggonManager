---
type: story
status: in_progress
id: story-opencode-adapter
title: OpenCode V2 adapter expansion (spec S4)
assignee: arggon-delivery-lead
parent: native-agent-adapters
labels: []
created: "2026-10-02"
updated: "2026-10-14"
claimed_at: "2026-10-14T12:42:49.141Z"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/story-opencode-adapter.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# OpenCode V2 adapter expansion (spec S4)

## Context

The reference helper's seam underuses what that helper does natively: sessions
open without the active work item stamped on admission, the board panel polls
instead of listening, and compaction can drop the very block that says which
item is being worked. The permission rules already come from the same matrix
row and stay that way.

This story expands the seam where the helper is strongest — admission stamps
the active item block, compaction preserves it, and the panel follows the event
stream — demonstrated end to end. (Spec-methodology-adapters-017 §S4.)

## Acceptance

- [x] Admission stamps the active work-item block (branch and item metadata) onto the session and compaction preserves that block, so the helper never loses which item it is working
- [x] The board panel refreshes from the event stream rather than polling and stays fresh while the session runs
- [x] Permission rules for the roles stay generated from the same matrix row, with the irreversible calls person-only and the review window scoped to the review
- [x] The expansion is demonstrated end to end with expected-vs-observed evidence in the review verdict, and the project's verification gates and `arggon validate` stay green with no new finding naming this story

## Notes
