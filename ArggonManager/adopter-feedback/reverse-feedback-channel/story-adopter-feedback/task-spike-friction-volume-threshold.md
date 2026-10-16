---
type: task
status: todo
id: task-spike-friction-volume-threshold
title: "Spike: what friction volume would justify stage-3 automation?"
parent: story-adopter-feedback
labels: [research]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-spike-friction-trigger-compliance]
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-spike-friction-volume-threshold.md
  Leaves live only under a story. id is the filename stem: task-spike-friction-volume-threshold.
  CLI `arggon create task spike-friction-volume-threshold` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: what friction volume would justify stage-3 automation?

## Context

A **spike, not a task**, and deliberately filed _before_ the evidence exists.
[exploration-adopter-feedback-channel-024](../../../docs/explorations/exploration-adopter-feedback-channel-024.md)
routes it here rather than guessing a number.

The question it exists to prevent: ADR 0024 leaves **stage 3 — anything
automatic — not decided and not scheduled**, precisely because a solo maintainer
with no volume data should not pick a threshold that triggers unattended
automation. `jedbjorn/subfloor#543` declined the automation outright and stated
why ("do not make automatic capture publish externally"), and
`ripple/xrpl-wasm-stdlib#311` runs an unattended rolling issue per fingerprint
weekly — the shape stage 3 would take if the threshold is ever crossed.

Until real volume exists, the correct state is "no automation", and this spike
records why so that a future agent reading ADR 0024 §Stage 3 does not invent a
number.

## Acceptance

- [ ] Depends on `task-spike-friction-trigger-compliance` completing; **not answerable before it.**
- [ ] The answer names a concrete volume measure (distinct reporters per fingerprint over what window) and what automation, if any, that volume would justify.
- [ ] If volume remains unmeasured, the recorded conclusion is explicitly "no automation; revisit only with data" — a null result is a valid and expected outcome.
- [ ] The conclusion is filed as a comment here and cross-referenced from ADR 0024's stage-3 bullet.
- [ ] Any automation it eventually proposes still respects ADR 0024 §4: no unattended submission, human action required.

### 2026-10-16 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead review — 2026-10-16 (delivery lead)
The spike answers exactly what its item asked, taking the compliance NULL as premise without re-litigating it. The volume measure is real, not abstract: reporters(F, 30d) ≥ 3 attributable distinct reporterIds spanning ≥ 2 weeks, on a non-test-noise fingerprint — and I verified the schema grounding against lib/src/friction.ts (16-hex length-prefixed fingerprint, 12-hex salted reporterId), including why raw counts false-fire (the live log's 202 records are 164+36 test-noise reporterIds for zero adopters), which is precisely why the measure demands attribution. The 30-day window fits the 5000-line rotation bound; the "3" comes from ADR 0024's own class-seen-in-three-repos ranking rather than invention. The null is explicit ("no automation; revisit only with data"), the reopen triggers are ordered and gated on the compliance re-sweep passing first (stage 3 never leapfrogs stage 2), and the only automation at threshold is maintainer-side draft prep with a human click — §4 intact. ADR cross-ref is a one-line additive note; status lines untouched. All five boxes ticked.

Merge holds with #851 on the same owner decision: this branch will trip the identical STALE-PROPOSED-ADR gate (ADR 0019, task-adr-0019-resolve-proposed-status carries the decide: brief). This item also cannot flip to done before its dependency flips. Both merges land once the decided: answer arrives, compliance first, then this one.
