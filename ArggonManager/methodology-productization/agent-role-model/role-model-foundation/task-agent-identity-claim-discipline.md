---
type: task
status: cancelled
id: task-agent-identity-claim-discipline
title: "Agent identity: the shipped agent prompts claim as their role id, never the product owner's login (ADR 0021 §5)"
parent: role-model-foundation
labels: [methodology, seam, roles]
priority: p2
created: "2026-10-04"
updated: "2026-10-04"
depends_on: [task-wire-role-model-carriers]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-agent-identity-claim-discipline.md
  Leaves live only under a story. id is the filename stem: task-agent-identity-claim-discipline.
  CLI `arggon create task agent-identity-claim-discipline` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Agent identity: the shipped agent prompts claim as their role id, never the product owner's login (ADR 0021 §5)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR 0021 §5 / exploration finding F5: `assignee` is documented as "GitHub login
**or agent id**" (`ArggonManager/docs/convention.md:168`) and validated by pattern
only (`lib/src/status.ts:38`), but the generated prompts claim with
`assignee: "<login>"` (`templates/docs/opencode/agents/arggon-coordinator.md:39`).
Agent work is therefore recorded under the human's identity, which corrupts
`list --assignee @me`, stale-claim reports and CODEOWNERS review routing. Doctrine
fix, no migration, no schema change.

## Acceptance

- [ ] The four shipped agent prompts (`arggon-coordinator`, `arggon-worker`, `arggon-reviewer`, `arggon-prover`) and the ZCode variants instruct claiming as the role id, never the product owner's login
- [ ] The instruction states *why*: a claim identifies the writer, and the writer is not the owner
- [ ] No schema/pattern change: the existing assignee pattern already allows a role id; a test asserts the shipped prompts name a non-login id
- [ ] `@me` resolution behavior documented (it resolves the human login — a role id will not appear in `--assignee @me`, which is correct, not a bug)
- [ ] Skill copies byte-equal if a skill reference changes
- [ ] `arggon validate` green; this item touches prompts/docs only, never the kernel

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
Cancelled and folded into `task-agent-role-contracts-seam`.

Reason (PM call, 2026-10-04): this item's payload was *"the shipped agent prompts claim
as their role id, never the product owner's login"* — and it targets
`templates/docs/opencode/agents/*.md`, which the seam item **rewrites wholesale** as part
of the rename. Running them as two items means two passes over the same files and a window
where a prompt says "claim as `arggon-worker`" while that id no longer ships.

It was also superseded on its merits by the carrier wiring (PR #636): the carriers now
state the role table and that *"the ids are wire names, not role names"*, and the seam
item's added criteria require the `Shipped id` column and the orchestration table to
carry the new ids. An agent claiming as `arggon-maker` instead of the PO's login is
therefore a property of the renamed prompts.

Every acceptance criterion moved verbatim into `task-agent-role-contracts-seam`; nothing
is dropped.
