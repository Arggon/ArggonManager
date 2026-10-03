---
type: task
status: todo
id: task-friction-trigger-carrier
title: "Friction trigger in generated agents, doctor visibility, skill reference"
parent: story-adopter-feedback
labels: [method, adopters]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-friction-surface-parity-and-docs]
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-trigger-carrier.md
  Leaves live only under a story. id is the filename stem: task-friction-trigger-carrier.
  CLI `arggon create task friction-trigger-carrier` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Friction trigger in generated agents, doctor visibility, skill reference

## Context

Plan task T6 for [spec-friction-capture-018](../../../docs/specs/spec-friction-capture-018.md),
stage 1 of [ADR 0021](../../../docs/adr/0021-adopter-friction-channel.md).

**This is the behavioral carrier change and the highest-risk item in the plan.**
Per `docs/agents.md` §Changing the methodology itself this is a **behavioral**
impact class: a rule agents must re-learn. Consequences the ADR settles:

- The trigger must live in the **generated agent files**, not only a skill
  reference. `deftai/directive#3633` shipped a sanctioned escalation skill and an
  agent actively escalating and following the rule that pointed at it still missed
  it; the friction was "absorbed into the session" — silent loss, which looks
  like success. Author's maxim: "a disabled capability nobody can see is absent."
- Opt-out must **not** gate the trigger's presence (ADR 0021 §3).

The ADR 0016 interaction is the part that is easy to miss: an adopter that has
acked its generated docs receives the trigger only as an `init --propose` side
file. Without the `doctor` block, "the channel is not live" is invisible — the
same failure ADR 0016 had to fix for docs with the `outdated` bucket.

`task-friction-tier-b-url-and-optout` must land first: the trigger text names the
command, and an agent file pointing at a missing command is worse than no trigger.

## Acceptance

- [ ] `templates/docs/opencode/agents/arggon-worker.md` and `…/arggon-coordinator.md` carry the marked `arggon:friction-trigger` block with `triggerVersion=<arggonVersion>`.
- [ ] The trigger text states that friction **in ArggonManager itself** is not adoptable work and must not be worked around or filed in the adopter's tracker.
- [ ] `doctor --json` reports `triggerPresent`/`triggerVersion` per managed agent file (with `task-friction-surface-parity-and-docs`).
- [ ] `x-friction: false` does not strip the trigger from a generated agent file (test).
- [ ] `skills/arggon-cli/references/friction.md` added and routed from `SKILL.md`; both stay byte-equal to their `.agents/skills/` copies (modulo the generated marker) — `cli/src/skill-copy.test.ts` green.
- [ ] `EVALS.md` gains a case deriving `arggon friction --report` from the **agent file alone**, with the new reference not visible to the deriving agent — the `deftai` lesson turned into a regression test.
- [ ] `docs/agents.md` §Self-improvement loop and `docs/agents.md` §0 cross-reference the channel; `docs/convention.md` documents the `x-friction` key; `README.md` gains the one-paragraph channel summary — all in this same PR.
- [ ] The PR description **and** a comment on this item state the impact class as **behavioral** and reference the ADR 0016 channel.
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green.
