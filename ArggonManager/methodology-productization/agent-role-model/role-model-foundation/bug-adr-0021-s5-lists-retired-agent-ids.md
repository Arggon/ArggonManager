---
type: bug
status: in_progress
id: bug-adr-0021-s5-lists-retired-agent-ids
title: "ADR 0021 §5 still lists the four retired agent ids as what agents claim as — factually wrong since PR #641"
assignee: arggon-delivery-lead
branch: fix/bug-adr-0021-s5-lists-retired-agent-ids
parent: role-model-foundation
labels: [docs, adr, roles]
priority: p2
created: "2026-10-05"
updated: "2026-10-05"
claimed_at: "2026-10-05T22:48:10.713Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-adr-0021-s5-lists-retired-agent-ids
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-adr-0021-s5-lists-retired-agent-ids.md
  Leaves live only under a story. id is the filename stem: bug-adr-0021-s5-lists-retired-agent-ids.
  CLI `arggon create bug adr-0021-s5-lists-retired-agent-ids` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0021 §5 still lists the four retired agent ids as what agents claim as — factually wrong since PR #641

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

PR #641 (`db8f9821`) renamed the four shipped agent ids to their role ids
(ADR 0021 §6.2a′). ADR 0021 **§5 — the authority map — still lists the old ids** in the
"agent" rows, so the decision record now states something factually false about the
artifacts it governs:

| old id | new id |
| --- | --- |
| `arggon-coordinator` | `arggon-delivery-lead` |
| `arggon-reviewer` | `arggon-standards-reviewer` |
| `arggon-worker` | `arggon-maker` |
| `arggon-prover` | `arggon-verifier` |

Reported by the seam worker, which correctly did not edit an ADR it did not own.

## Acceptance

- [ ] §5's authority-map rows name the four shipped ids (or point at §6.2a′'s mapping table, which is the single source)
- [ ] Added as a **dated amendment** in the header block, in the same style as §6.1 / §6.2 /
      §6.2a′ — the decision body is not rewritten
- [ ] Checked for the same drift in §1, §2 and §6.1's tables: any other place naming a retired id is corrected in the same amendment
- [ ] ADR index parity green (`cli/src/adr-index-parity.test.ts`); prettier clean; `arggon validate` ok
