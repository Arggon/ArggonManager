---
type: bug
status: todo
id: bug-native-steps-truncated-flag-dropped
title: "Native `preparation.steps` silently shortens past MAX_PREP_STEPS: the kernel sets `stepsTruncated` but `boundedPreparation` folds only its own 32-name cap, so the flag never fires on the native seam (the CLI keeps it)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, json-contract]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-native-steps-truncated-flag-dropped.md
  Leaves live only under a story. id is the filename stem: bug-native-steps-truncated-flag-dropped.
  CLI `arggon create bug native-steps-truncated-flag-dropped` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native `preparation.steps` silently shortens past MAX_PREP_STEPS: the kernel sets `stepsTruncated` but `boundedPreparation` folds only its own 32-name cap, so the flag never fires on the native seam (the CLI keeps it)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #609 (task-opencode2-payload-contract-preparation-fields), 2026-10-03, while documenting the `preparation` receipt — and **not fixed there**, because it is a real defect outside that item's acceptance.

**The defect.** The kernel caps the preparation log at `MAX_PREP_STEPS = 16` and sets `stepsTruncated` when it truncates. The native seam's `boundedPreparation` projects the payload but folds only **its own** 32-name cap into the flag — a cap that cannot fire through the kernel's 16. So on the native surface:

- more than 16 preparation steps → `steps` is silently shortened
- `stepsTruncated` is never set
- the agent sees a truncated list presented as complete

The CLI keeps the flag, so the two surfaces disagree on the same kernel event. That is the same parity defect class this session keeps meeting: one surface projects a receipt and forgets a field the other one carries (cf. the #596 native double-commit reporting `skipped: "nothing to commit"`, and the done-gate/goal-body divergence).

The honest fix is for the projection to trust the kernel's own flag rather than re-derive it — the kernel already decided; re-deriving is where the divergence came from.

Acceptance:
- [ ] Native `stepsTruncated` mirrors the kernel's decision; the projection does not re-derive it from a different cap
- [ ] A test drives `> MAX_PREP_STEPS` through the NATIVE seam and asserts both the shortened list AND the flag, matching the CLI's behavior on the same kernel event
- [ ] Sweep `boundedPreparation` (and any sibling native projection) for other kernel-set flags it recomputes instead of mirroring — the class, not this one field
- [ ] If a native cap genuinely must exist (the 32-name cap suggests one once did), say why and make it additive rather than a replacement for the kernel's decision
