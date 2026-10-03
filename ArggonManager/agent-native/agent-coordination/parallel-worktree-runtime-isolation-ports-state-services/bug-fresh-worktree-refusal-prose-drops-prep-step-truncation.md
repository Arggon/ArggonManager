---
type: bug
status: todo
id: bug-fresh-worktree-refusal-prose-drops-prep-step-truncation
title: "`freshWorktreeInstallRefusal` composes \"Preparation ran: …\" from the capped log without saying entries were dropped — a prose instance of the stepsTruncated defect both surfaces inherit"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, bounded-output]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-fresh-worktree-refusal-prose-drops-prep-step-truncation.md
  Leaves live only under a story. id is the filename stem: bug-fresh-worktree-refusal-prose-drops-prep-step-truncation.
  CLI `arggon create bug fresh-worktree-refusal-prose-drops-prep-step-truncation` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `freshWorktreeInstallRefusal` composes "Preparation ran: …" from the capped log without saying entries were dropped — a prose instance of the stepsTruncated defect both surfaces inherit

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #617 (bug-native-steps-truncated-flag-dropped), 2026-10-03, reported rather than fixed.

`freshWorktreeInstallRefusal` (`lib/src/worktree.ts:990-995`) composes `Preparation ran: …` **from the capped log without saying entries were dropped**. So the refusal text presents a truncated preparation log as complete — the PROSE version of the very defect #617 fixed in the native projection.

That matters more than a missing `truncated` flag usually would, because this string is what a human reads when a fresh worktree claim is refused: the preparation log is the evidence for *why* the install was judged unusable, and a silently shortened evidence list reads as "these are all the steps that ran".

It is also the third distinct surface for the same fact: the kernel decides, the native projection now mirrors, the CLI never carried it (`task-cli-surface-never-carries-steps-truncated`), and the refusal PROSE independently re-presents it. Four surfaces, one decision.

Acceptance:
- [ ] The refusal text says how many preparation entries were dropped when the log is capped — an explicit count, never a silent truncation
- [ ] Consistent with the kernel's own decision (mirror it; do not re-derive from a cap)
- [ ] A test at > `MAX_PREP_STEPS` asserting the refusal names the dropped count
- [ ] Swept: any other user-facing text that renders the preparation log without its truncation state
- [ ] Depends on PR #617 landing, so the native-side precedent is settled first
