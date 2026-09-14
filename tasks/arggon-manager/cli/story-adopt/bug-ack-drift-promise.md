---
type: bug
status: done
id: bug-ack-drift-promise
title: "adopt --ack: the 'hand edits still report modified' promise is false — acked drift is invisible"
assignee: Arggon
branch: fix/bug-ack-drift-promise
parent: story-adopt
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adopt/bug-ack-drift-promise.md
  Leaves live only under a story. id is the filename stem: bug-ack-drift-promise.
  CLI `arggon create bug ack-drift-promise` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# adopt --ack: the 'hand edits still report modified' promise is false — acked drift is invisible

## Context

Found by the estanteria MCP-first experiment (2026-09-14, session sess_c55374f3; verified by code read + live repro): the adoption task checklist (ADOPT_TASK_BODY, cli/src/adopt.ts:174) promises "Hand edits made AFTER this ack still report modified — the protection stays intact" — FALSE under the landed design. docs.ts:233-241 skips acknowledged entries unconditionally BEFORE comparing checksums (correct for content protection — bug-ack-baseline-regen-loss), and doctor.ts:95-99 counts acknowledged entries as healthy "whether or not it still matches the recorded checksum". Net: a hand edit after `adopt --ack` is invisible — no modified[], no drift signal anywhere. Repro: echo >> CHANGELOG.md post-ack -> init re-run skipped:17 modified:[], doctor modified:0 acknowledged:17 (evidence in the estanteria repo, .evidence/init-rerun-hand-edit.json).

Two possible resolutions (decide as design, then land):
(a) Reword the promise (checklist + docs): acknowledged = adopter-owned, drift intentionally not tracked. Cheapest, but loses the audit signal.
(b) Add drift visibility: doctor reports acknowledged entries whose current hash differs from the recorded baseline as a separate informational bucket (acknowledged-drifted — NOT modified, never a regeneration candidate), so the signal exists without reopening the content-loss door.

## Acceptance

- [x] The promise text in ADOPT_TASK_BODY matches the landed behavior (reworded per the chosen design)
- [x] Per the chosen design: either drift is reported (doctor bucket + tests) or the docs explicitly state drift is not tracked for acknowledged entries
