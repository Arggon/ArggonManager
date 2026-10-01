---
type: task
status: todo
id: task-adr-status-flips-0014-0015
title: "ADR status flips: 0014 and 0015 carry \"Accepted on merge\" but were never flipped"
parent: story-release-pipeline
labels: [docs, housekeeping]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-adr-status-flips-0014-0015.md
  Leaves live only under a story. id is the filename stem: task-adr-status-flips-0014-0015.
  CLI `arggon create task adr-status-flips-0014-0015` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR status flips: 0014 and 0015 carry "Accepted on merge" but were never flipped

## Context

Same drift class ADR 0016 had before its correction (PR #537): ADRs 0014
(zcode-native-seam) and 0015 (done-gate-acceptance-waiver) still read
`Status: Proposed (Accepted on merge)` — the lifecycle annotation without the
flip. The ADR index rows added by task-adr-index-rows mirror the files
verbatim, so the index is honest; the files themselves lag the merge.

## Acceptance

- [ ] Per-ADR merge evidence gathered (which PR/merge landed each ADR; both shipped — the ZCode seam per docs/agents.md §ZCode, the done gate per CHANGELOG 0.4.1 "Done gate" entry).
- [ ] Both ADR files' status lines flipped to `Accepted`, each with a dated status note recording the evidence and the flip commit (pattern: 0016's status note from PR #537).
- [ ] ADR index rows updated to `Accepted` in the same change.
- [ ] `arggon validate` ok; no other ADR content changes.

## Notes
