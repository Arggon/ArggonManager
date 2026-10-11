---
type: bug
status: todo
id: bug-goal-contract-unreadable-for-agent-held-claim
title: "`arggon goal <id>` refuses when the claim is held by an agent id and the invoking session differs, so a maker dispatched by the delivery lead cannot read the goal contract for the very item it was handed"
parent: tooling-and-environment
labels: [goal-mode, native-seam, orchestration]
created: "2026-10-11"
updated: "2026-10-11"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-goal-contract-unreadable-for-agent-held-claim.md
  Leaves live only under a story. id is the filename stem: bug-goal-contract-unreadable-for-agent-held-claim.
  CLI `arggon create bug goal-contract-unreadable-for-agent-held-claim` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `arggon goal bug-goal-contract-unreadable-for-agent-held-claim` refuses when the claim is held by an agent id and the invoking session differs, so a maker dispatched by the delivery lead cannot read the goal contract for the very item it was handed

## Context

Observed 2026-10-11 while a maker verified the acceptance completeness of an item the delivery
lead had dispatched. `arggon goal <id>` refused with "a goal never targets another identity's
claim": the item's claim is held by the agent id `arggon-delivery-lead`, and the invoking
session is the maker's own.

The consequence is specific to the orchestration this repo just built: the delivery lead claims
an item through `start` **before** dispatching a maker into it (`agents.md` §Orchestration →
Claim before dispatch), and goal mode is the surface that hands a worker its objective,
verification contract and boundaries. The dispatched maker therefore cannot read the goal
contract for the very item it was handed, and fell back to reading the live acceptance section
directly — which works, but loses the goal-mode framing and leaves the behaviour undocumented.

## Acceptance

- [ ] Reproduce the read path: an agent-claimed item plus a different invoking session, and the
      exact refusal, recorded in the issue body
- [ ] Decide and record which surface is correct — either `goal` is readable by any session for
      a claimed item (a read is not a write; the single-writer protections constrain writes), or
      the claim-owner check is intended behaviour and is documented as such with its reason
- [ ] If `goal` becomes readable by the dispatched maker, nothing else weakens: it stays
      read-only, still mutates nothing, and the claim / steal / reopen invariants are untouched
      (there is no `--as-claim-owner` write path, and none is added)
- [ ] `ArggonManager/docs/opencode2.md` and `ArggonManager/docs/json-output.md` state the
      behaviour, and the goal-mode suite pins it — without regressing the hermeticity that
      `bug-goal-mode-refusal-tests-not-hermetic` is about
- [ ] `npm test` green, `npm run build` ok, `arggon validate` ok

## Notes
