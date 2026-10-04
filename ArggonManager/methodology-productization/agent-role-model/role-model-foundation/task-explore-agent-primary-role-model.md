---
type: task
status: done
id: task-explore-agent-primary-role-model
title: "Greenfield exploration: agent-primary role model and the promotion policy (ADR 0017 six-phase protocol)"
assignee: arggon-coordinator
branch: feat/task-explore-agent-primary-role-model
parent: role-model-foundation
labels: [methodology, exploration]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
worktree_path: /home/arggon/Projects/ArggonManager-task-explore-agent-primary-role-model
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-explore-agent-primary-role-model.md
  Leaves live only under a story. id is the filename stem: task-explore-agent-primary-role-model.
  CLI `arggon create task explore-agent-primary-role-model` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Greenfield exploration: agent-primary role model and the promotion policy (ADR 0017 six-phase protocol)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Acceptance

- [x] Classified first per `skills/arggon-cli/references/exploration.md` Phase 0 (spike / bounded / greenfield) with the one-way ratchet recorded, including any mid-flight upgrade — **greenfield**, entered as bounded and upgraded mid-flight (see the doc's Classification section)
- [x] Exploration recorded at `ArggonManager/docs/explorations/exploration-agent-primary-workers-019.md` from `templates/exploration-project.md`: classification, frontier-rounds log (one entry per round), edge-case table (12 dimensions), approaches considered, decision
- [x] Research recorded with **dated sources** (candidates / criteria / findings / recommendation) — external practice AND repo-internal citations with file:line
- [x] Every hunted edge case resolves to exactly one of: a spec acceptance criterion, an explicit non-goal, or a spike item — nothing stays unknown
- [x] One recommendation with its trade-offs; the rejected candidates say why they lose
- [x] Cross-cutting decision recorded as an ADR under `ArggonManager/docs/adr/` (Proposed) that links this exploration, with Status / Date / Deciders / Context / Decision / Consequences / Alternatives considered — `0021-agents-primary-workers-human-product-owner.md`
- [x] Follow-up work filed as tracked `task`/`bug` items with context + acceptance checklists, `depends_on` wired so the ADR 0017 hard gate holds (no implementation task before a spec passes `spec analyze` with no NEW findings)
- [x] `arggon validate` and `arggon spec validate` green; PR opened with the methodology **impact class** stated (agents.md §Changing the methodology itself) — gates green and verified above; PR **#624** open, impact class stated as **Behavioral** in the description and here

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

verdict: approve

Self-review evidence for the exploration record (all commands run in the item's
worktree, expected vs observed):

- `npm run arggon -- validate` → expected `ok (0 warnings, convention v5)`; observed `arggon validate: ok (0 warning(s), convention v5)`
- `npm run arggon -- spec validate` → expected ok; observed `arggon spec: ok (32 doc(s), 5 warning(s))` — all 5 are pre-existing `DOC_NUMBER_COLLISION` on specs/plans/explorations 001/005/015; **none names `exploration-agent-primary-workers-019` or ADR 0021**
- `npm run arggon -- spec analyze` → 10 findings, all pre-existing (`duplicate-doc-number`, `no-error-path` on spec-deps-001/spec-opencode-seam-010, `vague-quantifier` on specs 009/005); grepped for `DECISION-PENDING|STALE-PROPOSED|SPEC-STATUS-DRIFT|019|0021` → **no matches**, i.e. the exploration's Decision names an ADR that now exists and introduced no NEW finding
- `tools.arggon.validate` → `ok: true`, 0 errors, 0 warnings after the four follow-up items and their `depends_on` wiring
- Doc-number choice: `-019` is the next FREE number in `docs/explorations/` (highest in use 018, per `agents.md:447`); ADR `0021` is next free after 0020
- Every one of the 12 edge-case rows resolves to a spec AC, an explicit non-goal, or a deferred-with-evidence item — none left `unknown`
- Not run: `npm test` — this change adds no code (two markdown docs + tracker items), and no behavioral test exists for doc content

No NEW `spec analyze` findings means the ADR 0017 hard gate is satisfied for the
spec item; the implementation items are wired behind it via `depends_on`.

**Acceptance tick-off:** the checklist above is complete — classification with the
one-way ratchet recorded (bounded → greenfield), the exploration at
`ArggonManager/docs/explorations/exploration-agent-primary-workers-019.md`, dated
research (8 primary external sources + 1 explicitly-labeled secondary, plus
repo-internal `file:line` citations), all edge cases resolved, one recommendation
with trade-offs, ADR 0021 (Proposed) linking this exploration, and four tracked
follow-ups with acceptance checklists and deps.

Remaining for the human: merge the PR (which is what flips ADR 0021 to Accepted
per the ADR lifecycle) and, if they accept the decision, claim the spec item.
