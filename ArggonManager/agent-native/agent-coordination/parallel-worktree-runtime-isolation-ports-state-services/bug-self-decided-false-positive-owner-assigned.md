---
type: bug
status: in_progress
id: bug-self-decided-false-positive-owner-assigned
title: "`self-decided` would report itself on an owner-assigned item: ADR 0021's `self-accepted` keys on the item's own assignee, but a brief answered by the product owner on an item assigned to that same owner is a normal, legitimate state — attribution cannot tell the agent answering its own brief from the owner answering a brief on their own item"
assignee: arggon-delivery-lead
branch: fix/bug-self-decided-false-positive-owner-assigned
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [tracker-schema, cli]
created: "2026-10-06"
updated: "2026-10-15"
claimed_at: "2026-10-15T10:32:34.161Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-self-decided-false-positive-owner-assigned
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

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
**Decision (2026-10-15, delivery lead — recorded with authority per the item's box 2): the semantics STAY "the `decided:` author equals the item's own assignee".**

Rationale: the tracker has no identity layer, so "an agent role answered its own brief" is not determinable — any implementation would be a new id-shape taxonomy asserting a certainty the tracker deliberately does not have (the same limit ADR 0021 §4 already states for `self-accepted`). The owner-assigned case is not an anomaly to suppress but the NORMAL owner answer: `self-decided` is a same-name hint, and on an owner-assigned item the same name IS the owner. The state is report-only; the honest resolution is to state the case where readers meet it (spec §States, `json-output.md` §`decision_brief`, the engineering brief convention) and pin the behaviour with the repro test, so it is intentional rather than accidental.

Implementation routed to a maker on `fix/bug-self-decided-false-positive-owner-assigned`: the repro pin, an ADR 0026 dated amendment, the three doc statements, report-only preservation, gates.

### 2026-10-15 @arggon-maker
**Evidence (maker) — PR [#837](https://github.com/Arggon/ArggonManager/pull/837), branch `fix/bug-self-decided-false-positive-owner-assigned`.**

Decision implemented as recorded (semantics STAY "the `decided:` author equals the item's own `assignee`"); `lib/src/brief.ts` is untouched.

**Repro (box 1)** — scratch tracker, CLI from source:

```bash
arggon update story-login --status in_progress --assignee gonzalo --no-commit
arggon comment story-login "decide: add a second supplier?" --author lead --no-commit
arggon comment story-login "decided: option B" --author gonzalo --no-commit
arggon show story-login --json
```

expected `decision_brief: "self-decided"` (assignee == answer author, the normal owner answer); observed `decision_brief = "self-decided"`, `assignee = gonzalo`. Identical on `main` — this change is the pin plus the statement, not a behaviour change.

Pinned in `cli/src/decision-brief-convention.test.ts` at both layers: classifier (`classifyDecisionBrief(body, "gonzalo")` → `self-decided`) and CLI (`arggon show story-login --json` → `self-decided`, with `spec analyze` returning no finding — only `open` fires, box 4).

**Files**: ADR 0026 dated amendment (2026-10-15); `spec-owner-decision-brief-021.md` §States; `json-output.md` §`decision_brief`; `engineering.md` §Roles and authority → The decision brief; the test file.

**Gates (box 5)**: `arggon validate` ok (0 warnings); `vitest run cli/src/decision-brief-convention.test.ts` 36 passed; `npm run build` + `npm test` 159 files / 3509 tests passed; `npm run lint` clean; `npm run test:structure` 5 passed + ast-grep scan exit 0; `prettier --check` clean on the 5 touched files; `arggon spec validate` ok (38 docs); `arggon spec analyze` 4 pre-existing findings, none for spec 021, exit 0 (report-only).

Note: the lead's decision comment (56aa4f02, local main unpushed) was cherry-picked onto the branch so the item body is complete; expect a trivial item-file union at merge.
