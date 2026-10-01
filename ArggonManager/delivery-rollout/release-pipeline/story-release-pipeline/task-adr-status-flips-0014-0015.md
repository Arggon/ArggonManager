---
type: task
status: done
id: task-adr-status-flips-0014-0015
title: "ADR status flips: 0014 and 0015 carry \"Accepted on merge\" but were never flipped"
assignee: Arggon
branch: feat/task-adr-status-flips-0014-0015
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

- [x] Per-ADR merge evidence gathered: 0014 added in 0a340798 (`task-mcp-full-surface`), merged via PR #436 (`514f9efa`, verified with `--ancestry-path` first-merge); 0015 added in c801aea6 (kernel done gate + `--waive`), merged via PR #442 (`f1195d67`); both shipped (0014: docs/agents.md §ZCode; 0015: CHANGELOG 0.4.1).
- [x] Both ADR files' status lines flipped to `Accepted`, each with a dated status note recording the evidence (PR #553).
- [x] ADR index rows updated to `Accepted` in the same change.
- [x] `arggon validate` ok; no other ADR content changes (diff: two status lines + two notes + two index rows).

## Notes

### 2026-10-01 @ses_f0870e73affeEVvaFZPi9K7NDj
Done via PR #553 (merged 0d1f2263, all lanes green; coordinator-inline mechanical docs change with self-review).

Evidence recorded in the dated status notes: 0014 — PR #436 (commit 0a340798, task-mcp-full-surface; ZCode seam live); 0015 — PR #442 (commit c801aea6, kernel done gate + --waive; shipped per CHANGELOG 0.4.1). Index rows updated to mirror the files (task-adr-index-rows rule preserved).

ADR status ledger is now fully consistent: 0014, 0015, 0016, 0017, 0018 all Accepted; the only remaining Proposed rows (0002, 0003, 0004 per the index) are recorded as prototype/folded states — the tracker owner can adjudicate those separately if wanted.
