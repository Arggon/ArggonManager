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

Plan task T6 for [spec-friction-capture-020](../../../docs/specs/spec-friction-capture-020.md),
stage 1 of [ADR 0024](../../../docs/adr/0024-adopter-friction-channel.md).

**This is the behavioral carrier change and the highest-risk item in the plan.**
Per `docs/agents.md` §Changing the methodology itself this is a **behavioral**
impact class: a rule agents must re-learn. Consequences the ADR settles:

- The trigger must live in the **generated agent files**, not only a skill
  reference. `deftai/directive#3633` shipped a sanctioned escalation skill and an
  agent actively escalating and following the rule that pointed at it still missed
  it; the friction was "absorbed into the session" — silent loss, which looks
  like success. Author's maxim: "a disabled capability nobody can see is absent."
- Opt-out must **not** gate the trigger's presence (ADR 0024 §3).

The `doctor` block is owned **solely** by this task (ADR 0024 §2), and its
justification is narrow — note the self-correction, because this paragraph
previously argued the opposite while naming the mechanism that already works:

- `doctor.ts` re-renders the current template for every `config.generated` entry
  in every local state, **including acked**, and the generated agent files are in
  that map. So editing the worker template alone already surfaces a missing
  trigger as an outdated managed doc. **"The channel is not live" is not
  invisible today**, and this task must not be justified as though it were.
- What the block buys instead: a **per-file `triggerVersion`**, and separating
  **_trigger absent_ from generic template drift** — the observable
  `task-spike-friction-trigger-compliance` needs to distinguish "never seen"
  from "seen and ignored". That spike gates stage 2 and tier C, so the block's
  value is measured, not assumed.

If stage 1 must be minimal, cut `triggerVersion` and `files`, **not** the block.

`task-friction-tier-b-url-and-optout` must land first: the trigger text names the
command, and an agent file pointing at a missing command is worse than no trigger.

## Acceptance

- [ ] `templates/docs/opencode/agents/arggon-worker.md` and `…/arggon-coordinator.md` carry the marked `arggon:friction-trigger` block with `triggerVersion=<arggonVersion>`.
- [ ] The trigger text states that friction **in ArggonManager itself** is not adoptable work and must not be worked around or filed in the adopter's tracker.
- [ ] `doctor --json` reports `triggerPresent`/`triggerVersion` per managed agent file. Owned solely by this task; `task-friction-surface-parity-and-docs` documents the field but does not own or test it.
- [ ] `x-friction: false` does not strip the trigger from a generated agent file (test).
- [ ] `skills/arggon-cli/references/friction.md` added and routed from `SKILL.md`; both stay byte-equal to their `.agents/skills/` copies (modulo the generated marker) — `cli/src/skill-copy.test.ts` green.
- [ ] `EVALS.md` gains a case deriving `arggon friction --report` from the **agent file alone**, with the new reference not visible to the deriving agent — the `deftai` lesson turned into a regression test.
- [ ] `docs/agents.md` §Self-improvement loop and `docs/agents.md` §0 cross-reference the channel; `docs/convention.md` documents the `x-friction` key; `README.md` gains the one-paragraph channel summary — all in this same PR.
- [ ] The PR description **and** a comment on this item state the impact class as **behavioral** and reference the ADR 0016 channel.
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green.
