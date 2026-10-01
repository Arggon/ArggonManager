---
type: task
status: todo
id: task-greenfield-explore-carriers
title: Wire greenfield exploration protocol into the methodology carriers
parent: greenfield-explore
labels: []
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/greenfield-explore/task-greenfield-explore-carriers.md
  Leaves live only under a story. id is the filename stem: task-greenfield-explore-carriers.
  CLI `arggon create task greenfield-explore-carriers` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Wire greenfield exploration protocol into the methodology carriers

## Context

Implements the decision recorded by task-greenfield-explore-adr: the
**six-phase Greenfield Exploration Protocol** (classify → stance → ground →
frontier rounds → edge-case hunt → approaches/artifacts/gates), fully specified
in that task's body — **read it first** and keep the wording consistent with
it. The protocol becomes the default first phase for greenfield work.

Every file you touch is a **methodology carrier**: follow
`ArggonManager/docs/agents.md` §Changing the methodology itself — the PR must
state the impact class (**Behavioral** — agents must re-learn a pipeline step),
reference ADR 0017 and the adopter-upgrade channel (ADR 0016), keep the skill
and its copies in sync in the same PR (`skills/arggon-cli/` ↔
`.agents/skills/arggon-cli/`, byte-equal), and update every doc statement the
change makes false. Read ADR 0016 first and follow whatever it requires for
behavioral changes.

Voice/structure guidance: the new reference mirrors the existing
`references/methodology.md` (tables over prose, bounded sections, imperative).
Context budget applies (ADR 0006; exploration-014 C5): lean the reference, lean
the agents.md pointer.

## Acceptance

- [ ] New `skills/arggon-cli/references/exploration.md`: the six-phase protocol — classification gate table (spike / bounded / greenfield + one-way ratchet), stance (thinking-not-building, permitted writes = methodology artifacts), ground (verify before asking), frontier rounds (whole-frontier semantics + the domain ordering bank: outcome/users → scope → constraints → data → interfaces → failure/edge → ops/security → rollout, plus "I don't know → spike" and "ballooning → decompose"), edge-case hunt (the 12-dimension checklist and the three-way resolution rule: spec acceptance criterion | explicit non-goal | spike item — nothing stays unknown), approaches (2–3 with trade-offs, YAGNI, decompose-first), artifacts + hard gate (greenfield exploration doc → ADRs → spec with hunted cases as acceptance criteria → `arggon spec analyze` no NEW findings → plan/tasks with depends_on; no implementation task claimed before that), self-review (placeholder scan, consistency, scope, ambiguity).
- [ ] `skills/arggon-cli/SKILL.md`: the references table gains the `references/exploration.md` row (read-it-for column in the same style), and the §4 pipeline sentence mentions exploration-first for greenfield. No version bump, no other edits.
- [ ] `skills/arggon-cli/references/methodology.md`: the work-classification table gains the greenfield/new-project row (exploration-first default + hard gate before implementation tasks).
- [ ] Byte-equal copies under `.agents/skills/arggon-cli/` — `cli/src/skill-copy.test.ts` must pass unchanged.
- [ ] `/arggon-explore` command updated everywhere it lives — find every copy (`grep -rl "arggon-explore" templates/ opencode/ .opencode/ templates/docs/`): the OpenCode source template, the generated `.opencode/commands/arggon-explore.md` (regenerate or byte-mirror the source including the generated marker), the ZCode command template, and any other generated copy. Step 1 becomes "classify: spike / bounded / greenfield"; greenfield routes through the protocol (pointing at `references/exploration.md`); the existing stack-spike flow stays for stack decisions.
- [ ] `templates/exploration.md` gains the project-exploration variant — either a new `templates/exploration-project.md` (sections: classification, frontier-rounds log, edge-case table with columns dimension / hunted case / resolution, approaches considered, decision/ADR links) or a clearly separated second mode; check `cli/src` for template-copy/fixture tests first and keep them green.
- [ ] `ArggonManager/docs/agents.md`: ONE lean pointer (≤3 lines, §Specs and plans or §Technology playbooks — pick one place) noting the greenfield exploration gate and pointing at the reference + ADR 0017. Do not restate the protocol there.
- [ ] PR body states `Impact class: Behavioral`, references ADR 0017 and ADR 0016; post the same statement as an `arggon comment` on this item.
- [ ] `npm test` and `npm run arggon -- validate` green; no changes under `ArggonManager/docs/explorations/` or `ArggonManager/docs/adr/` (task-greenfield-explore-adr owns those).

## Notes

PR references this item id. Never flip this item done yourself — the
coordinator flips after merge verification. The ADR number in this task assumes
0017 is free; if the adr task landed a different number, follow the actual
number.
