---
type: task
status: todo
id: task-migrate-7-leaves-with-no-live-acceptance-contract
title: "7 open leaves have zero criterion rows anywhere and are now un-flippable: author a live acceptance contract for each"
parent: methodology-improvements
labels: [tracker-schema, done-gate]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-migrate-7-leaves-with-no-live-acceptance-contract.md
  Leaves live only under a story. id is the filename stem: task-migrate-7-leaves-with-no-live-acceptance-contract.
  CLI `arggon create task migrate-7-leaves-with-no-live-acceptance-contract` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# 7 open leaves have zero criterion rows anywhere and are now un-flippable: author a live acceptance contract for each

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
Filed from the review of PR #656. The migration half of the `no-live-contract` rule's cost.

### Context

PR #656's second rule refuses a claimable leaf whose live `## Acceptance` section publishes no criterion. The reviewer measured the blast radius precisely, and it is **much smaller than the change's own comment claimed** — the correction matters, so it is recorded here:

| pre-fix → post-fix | count |
| --- | --- |
| refused → refused (40 relabelled `no-live-contract`, 29 `unchecked-live-criteria`) | 69 |
| **allowed → refused (genuinely newly stranded)** | **7** |
| refused → allowed (unblocked) | 3 |

The 40 items whose criteria sit in dated comments were **already refused before the change** — they carry 223 criterion rows, all unticked, so they were refused for the right reason already and only the label moved. The genuinely stranded set is **7 open leaves with zero criterion rows anywhere**: items that never published a contract at all.

This item owns those 7. One of them is PR #656's own item, whose live `## Acceptance` is still the template placeholder; the maker correctly left it rather than ticking its own homework.

### Acceptance

- [ ] Enumerate the 7 by re-running the measurement the reviewer used — do not take this list as authoritative; the set moves as items land
- [ ] For each, author a real live `## Acceptance` contract: the criteria that item actually carries, transcribed with their evidence. Where the item's real obligations live only in dated comments, the live section states them as current state and the dated blocks stay verbatim
- [ ] Each transcribed contract is **honest**: a criterion is ticked only where the evidence supports it. If any of the 7 has a genuinely open criterion, it stays un-flippable and that is recorded rather than tidied away
- [ ] Each item's dated `## Notes` blocks are left exactly as written — this is a transcription into the live body, not an edit of history
- [ ] No waivers are used. This is the point of the item: the gate is satisfied because the contract exists and is met, not because it was bypassed
- [ ] After the migration, re-run `spec analyze --baseline` / `validate` and report how many leaves remain refused, so the number is not asserted from this note
