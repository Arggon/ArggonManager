---
type: bug
status: todo
id: bug-self-decided-false-positive-owner-assigned
title: "`self-decided` would report itself on an owner-assigned item: ADR 0021's `self-accepted` keys on the item's own assignee, but a brief answered by the product owner on an item assigned to that same owner is a normal, legitimate state — attribution cannot tell the agent answering its own brief from the owner answering a brief on their own item"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [tracker-schema, cli]
created: "2026-10-06"
updated: "2026-10-06"
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-self-decided-false-positive-owner-assigned.md
  Leaves live only under a story. id is the filename stem: bug-self-decided-false-positive-owner-assigned.
  CLI `arggon create bug self-decided-false-positive-owner-assigned` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `self-decided` would report itself on an owner-assigned item: ADR 0021's `self-accepted` keys on the item's own assignee, but a brief answered by the product owner on an item assigned to that same owner is a normal, legitimate state — attribution cannot tell the agent answering its own brief from the owner answering a brief on their own item

## Context

`self-decided` keys on the item's own assignee, so a brief answered by the product owner on an item assigned to that same owner reads as self-answered even though it is the normal legitimate state. The definition is explicit: `ArggonManager/docs/specs/spec-owner-decision-brief-021.md:165` states `self-decided` when the `decided:` was written by the item's own assignee (reported, never blocked, mirroring `self-accepted`), and `:120` names the case it exists to surface — the lead answering his own question. The classifier implements exactly that string match: `lib/src/brief.ts:157` (`self-decided` — the answer written by the item's own assignee), `:166` (`classifyDecisionBrief(body, assignee)`), with `:164` noting an unassigned item can never read as self-decided, and the case-insensitive `sameOwner` at `:135-137`. The sibling convention is identical: ADR 0021 §4 (`ArggonManager/docs/adr/0021-agents-primary-workers-human-product-owner.md:312-315`) reports an acceptance whose author equals the item's own assignee as `self-accepted`.

The false positive follows from the role shape in `ArggonManager/docs/engineering.md` §Roles and authority: a brief is lead-written `decide:` and owner-answered `decided:` (`:119-122`), but `assignee` is the claim holder — and nothing forbids an item claimed by (assigned to) the product owner's own login. When that happens and the owner answers the brief, author equals assignee, so the classifier reports `self-decided`. Attribution (comment `@author` vs frontmatter `assignee`) cannot tell "an agent answered its own brief" from "the owner answered a brief on their own item", because the tracker has no identity layer — the same limit ADR 0021 §4 and `engineering.md:138` state for the whole brief surface (report-only, never a gate).

## Acceptance

- [ ] The false positive is pinned: an item assigned to the owner's login with a lead-written `decide:` and a same-login `decided:` reads `self-decided` today (repro as command / expected / observed via `arggon show <id> --json` or `classifyDecisionBrief(body, assignee)`)
- [ ] The intended semantics are decided and recorded with authority (ADR 0021/0026 amendment, not a code tweak): whether `self-decided` means "answer author == assignee" (current) or "an agent role answered its own brief" (which the tracker cannot authenticate — `engineering.md:138`)
- [ ] If the semantics stay author == assignee, the owner-assigned false positive is stated explicitly where readers will find it (`spec-owner-decision-brief-021.md` §States, `ArggonManager/docs/json-output.md` §`decision_brief`, and the engineering brief convention); if they change, the classifier, its tests, and the spec change together
- [ ] Report-only preserved: no transition consults the state, no command refuses, CI never fails (ADR 0026 §6); `decided` and `self-decided` stay silent in `spec analyze` (only `open` fires `UNANSWERED-DECISION-BRIEF`)
- [ ] `arggon validate` green, `decision-brief-convention.test.ts` green, prettier clean

## Notes
