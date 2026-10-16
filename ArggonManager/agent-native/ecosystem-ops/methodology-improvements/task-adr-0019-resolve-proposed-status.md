---
type: task
status: in_progress
id: task-adr-0019-resolve-proposed-status
title: "Resolve ADR 0019's Proposed status (STALE-PROPOSED-ADR gate is red — blocks every PR)"
assignee: arggon-delivery-lead
branch: feat/task-adr-0019-resolve-proposed-status
parent: methodology-improvements
labels: []
created: "2026-10-16"
updated: "2026-10-16"
claimed_at: "2026-10-16T09:33:34.943Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-0019-resolve-proposed-status
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr-0019-resolve-proposed-status.md
  Leaves live only under a story. id is the filename stem: task-adr-0019-resolve-proposed-status.
  CLI `arggon create task adr-0019-resolve-proposed-status` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Resolve ADR 0019's Proposed status (STALE-PROPOSED-ADR gate is red — blocks every PR)

## Context

ADR 0019 (worktree runtime isolation, dated 2026-10-01) is still marked Proposed. The repo's spec gate (`spec analyze`, STALE-PROPOSED-ADR, 14-day threshold) now fails on every PR until the ADR is recorded Accepted, Rejected, or Superseded — PR #851 was the first to hit it. The whole ADR content has shipped (all four decision points plus amendments, epic agent-coordination closed), and the record already notes the product owner accepted the recommendation on 2026-10-01; only the status line lags. The status flip itself is the owner's call, so this task carries a decide: brief and waits for a decided: answer. Precedent: task-adr-status-housekeeping (done 2026-09-29) resolved stuck Proposed statuses the same way.

## Acceptance

- [ ] The product owner answers the decide: brief with a decided: comment (accept, reject, or supersede — with the reasoning recorded).
- [ ] ADR 0019's status line is updated exactly per that answer, as a dated appended note; no other content rewritten (never-rewrite rule).
- [ ] `arggon spec analyze` is green against the baseline again (docs-only PR; `arggon validate` ok).

## Notes

### 2026-10-16 @ses_eccc605dbffeHEwy9fqO3FP5tx

decide:

### Decision brief — ADR 0019's status (delivery lead, 2026-10-16)

**1. The question.** ADR 0019 (worktree runtime isolation) has sat at status Proposed since 2026-10-01; the repo's own spec gate now fails every PR until it is marked Accepted, Rejected, or Superseded. Should it be recorded Accepted?

**2. Why it matters.** In plain terms: a design proposal from two weeks ago was fully built (all four decision points shipped, the whole epic closed), but nobody stamped it finished — and now an automatic check refuses to let ANY work merge until someone does. Every open PR, including the finished friction-spike (#851), is stuck behind this stamp.

**3. Options.**

- **A. Record Accepted** (recommendation): append a dated note that the content shipped via the agent-coordination epic (closed) and the status now matches the owner's 2026-10-01 acceptance of the recommendation already on the record. Consequence: the gate goes green, PRs flow; costs one docs-only line, no behavior change.
- **B. Record Rejected**: would mean the shipped worktree-isolation behavior should be removed — consequence: a large revert program across CLI, plugin, and docs; contradicts the closed epic and the owner's recorded acceptance.
- **C. Record Superseded**: only correct if a newer decision replaced it — consequence: requires naming that decision; none exists (the amendments all landed inside 0019 itself).

**4. Recommendation.** Option A. The work is done and the owner's acceptance of the recommendation is already written in the ADR itself; this only makes the status line tell the truth. Honest cost: stamping Accepted closes off "we might still rethink worktree isolation" — but nothing about the implementation is still open, so that door is already shut in practice.

**5. Strongest argument against it.** A status flip on a durable design record is exactly the kind of thing that should not happen by momentum: if the owner intended "accepted the recommendation, still watching the outcome" rather than full acceptance, stamping Accepted over-reads the 10-01 note — and the whole point of the authority split is that the lead does not resolve that ambiguity alone.

**6. Default.** If no answer arrives by 2026-10-23, I will NOT flip the status; PRs stay blocked on the red gate and I re-raise this brief once. (Authority map: product acceptance belongs to the owner; the lead recommends.)

---

**Hold note (lead, 2026-10-16):** PR #851 (friction spike, otherwise green and approved) cannot merge until this is answered — the STALE-PROPOSED-ADR finding fires on every branch while 0019 stays Proposed. Nothing in #851 can fix that; gaming the baseline to silence it would falsify the gate and is not on the table.

### 2026-10-16 @ses_eccc605dbffeHEwy9fqO3FP5tx
decided: Accept (product owner, in session 2026-10-16).
verdict: approve
### Lead close-out — 2026-10-16 (delivery lead)
Executed per the owner's Accept: ADR 0019 status line → Accepted with a dated note citing the 2026-10-01 acceptance already on the record + the closed epic; no other content rewritten (never-rewrite rule, task-adr-status-housekeeping idiom). The ADR index row mirrors the new status (the parity gate caught the lag on the first CI run — fixed in-branch before merge). Merged as 487ab337 (PR #853), all three lanes green; spec analyze confirms 0 new findings vs baseline. This unblocks every PR behind the STALE-PROPOSED-ADR gate.
