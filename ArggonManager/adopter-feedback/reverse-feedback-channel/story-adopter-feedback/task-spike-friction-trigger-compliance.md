---
type: task
status: in_progress
id: task-spike-friction-trigger-compliance
title: "Spike: does an embedded trigger fire more reliably than a skill reference?"
assignee: arggon-delivery-lead
branch: feat/task-spike-friction-trigger-compliance
parent: story-adopter-feedback
labels: [method, research]
priority: p2
created: "2026-10-02"
updated: "2026-10-15"
claimed_at: "2026-10-15T23:18:37.313Z"
depends_on: [task-friction-trigger-carrier]
worktree_path: /home/arggon/Projects/ArggonManager-task-spike-friction-trigger-compliance
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-spike-friction-trigger-compliance.md
  Leaves live only under a story. id is the filename stem: task-spike-friction-trigger-compliance.
  CLI `arggon create task spike-friction-trigger-compliance` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: does an embedded trigger fire more reliably than a skill reference?

## Context

A **spike, not a task**: it builds nothing and implements nothing. It answers the
one open question
[exploration-adopter-feedback-channel-024](../../../docs/explorations/exploration-adopter-feedback-channel-024.md)
deliberately refused to guess at, and it **gates stage 2**.

The question: do adopters run the command? The evidence says instruction-only
compliance is insufficient — `deftai/directive#3633` shipped a skill documented
as the sanctioned escalation route and an agent that was actively escalating and
following the rule pointing at it still missed it, because a policy flag
defaulted off, the skill was absent from the host's skill-discovery inventory,
and the `REFERENCES.md` index the managed `AGENTS.md` told agents to scan was
never deposited. But that is evidence about a **skill reference**. It says
nothing about a command embedded in the agent files the adopter already loads —
which is exactly the change ADR 0024 makes and exactly what stage 1 ships.

So the spike measures the thing stage 1 actually changed.

Two real adopters exist on this machine: `../ArggonStores` and this repo.

## Pre-registered criterion (2026-10-15, before the sweep)

**The question.** Do adopters run `arggon friction` once the command is embedded
in the agent files they already load — the carrier `task-friction-trigger-carrier`
(PR #850) shipped — rather than only referenced from a skill?

**Population.** Every git work tree on this machine carrying an ArggonManager
tracker (`ArggonManager/.convention.yml` or `tasks/.convention.yml`), observed
read-only on 2026-10-15. `../ArggonStores` is the non-maintainer adopter; this
repo's own checkouts are the maintainer comparator, recorded separately and never
counted as adopter evidence.

**Primary pass/fail — fixed before the numbers are read.**

- **PASS** — at least one observed **non-maintainer adopter** repo yields ≥1 record
  of an actual invocation: a line in its friction log whose `reporterId` matches
  that repo's absolute path, or an invocation recorded in the repo's own history
  (commit message, diff or comment).
- **NULL (fail)** — zero adopter-attributable records across N observed adopter
  repos.
- Anything else — records present but unattributable to any observed path — is
  recorded as `INCONCLUSIVE` with the reason, never folded into either arm.

**Covariates recorded per repo.** They decide what a NULL _means_; they do not
move the bar.

1. `arggon doctor --json`'s `friction.triggerPresent`, per managed agent file,
   with `triggerVersion`. "Never seen" ≠ "seen and ignored".
2. Reachability of the command at that repo: the generated-commands inventory in
   `.agents/skills/arggon-cli/SKILL.md`, `references/friction.md`, and the vendored
   plugin's native tool set. A NULL is only meaningful where the command was
   reachable.
3. Provenance of the generated files (`x-generated` `generatedAt` /
   `arggonVersion`): an adopter whose files predate PR #850 cannot have seen the
   trigger.

**Decision rule for stage 2.**

- **PASS** → tier C (`gh` upstream dedupe) may proceed as stage 2.
- **NULL + `triggerPresent` false everywhere (never seen)** → the trigger has
  never been observable at an adopter on this machine. Record `NOT-YET-MEASURABLE`,
  defer stage 2, and re-measure after the adopter's next `arggon init` (a
  re-measurement trigger, not a win and not a loss).
- **NULL + `triggerPresent` true (seen and ignored)** → the trigger is not
  sufficient; tier B (the prefilled URL a human opens) becomes the whole channel.
  **No added instruction pressure.**
- A NULL is recorded explicitly as the input to that choice — never as a failed
  spike.

**What this measurement can and cannot establish.** It CAN establish, at one
instant, whether any record exists that is attributable to an observed repo, and
whether the trigger bytes were on disk at that instant. It CANNOT establish
longitudinal behaviour: this is a point-in-time observation, on one machine, with
N adopters in the low single digits, where the maintainer and the adopter share a
human. It cannot separate "no agent ever hit friction" from "an agent hit friction
and did not record it" — only the log and the repos' own history speak, which is
the exact silence/absence ambiguity the `deftai` post-mortem failed on, and the
reason this criterion is committed before the sweep rather than written after it.

## Acceptance

- [ ] `depends_on: [task-friction-trigger-carrier]` is present, so this spike is not
      claimable before the trigger it measures exists (reviewer N2: the ADR makes it
      the gate on stage 2 **and** tier C, yet it was claimable while `arggon friction`
      did not exist).
- [ ] A pass/fail criterion is written **before** any observation is collected (the `deftai` post-mortem failed partly because "silent" was indistinguishable from "absent").
- [ ] At least one non-maintainer adopter repo is observed end to end: `arggon friction` invoked, or demonstrably not, with the transcript kept.
- [ ] `arggon doctor --json`'s `friction.triggerPresent` is recorded for each observed repo, so "the trigger was never seen" is distinguishable from "the trigger was seen and ignored".
- [ ] The result is reported as a number with its denominator (N repos observed, N with the trigger present, N with a record written) — not as a qualitative impression.
- [ ] The finding is filed as a comment on this item, and the answer decides whether **stage 2** (tier C, `gh` upstream dedupe) proceeds, is deferred, or is abandoned in favor of a human-only channel.
- [ ] Explicitly recorded even if the answer is "nobody ran it": a null result here is the input to choosing tier B as the primary channel rather than tier C.

## Notes

Non-goal: shipping any code in this spike. If the answer is negative, the honest
response is to make tier B (the prefilled URL a human clicks) the whole channel —
not to add instruction pressure.
