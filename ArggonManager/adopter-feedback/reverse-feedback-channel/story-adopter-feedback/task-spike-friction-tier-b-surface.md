---
type: task
status: todo
id: task-spike-friction-tier-b-surface
title: "Spike: Issues or Discussions as the tier-B prefilled surface?"
parent: story-adopter-feedback
labels: [research]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-spike-friction-tier-b-surface.md
  Leaves live only under a story. id is the filename stem: task-spike-friction-tier-b-surface.
  CLI `arggon create task spike-friction-tier-b-surface` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: Issues or Discussions as the tier-B prefilled surface?

## Context

A **spike, not a task**: it answers one bounded question and recommends.

Tier B emits a prefilled URL that a human opens. Which surface? Ground truth at
decision time: `Arggon/ArggonManager` has `hasIssuesEnabled: true` and
`hasDiscussionsEnabled: false`; 21 issues exist, all closed, all created
2026-09-03 → 2026-09-11 — exactly the pre-tracker era, abandoned when the
in-tree tracker landed. `exploration-repo-visibility-011` recorded "issues enabled
but unused (tracker is in-tree)".

The trade is mechanical, not ideological:

- **Issues** — richer prefill (`title`/`body`/`labels` query params, Issue Forms
  YAML, six-form patterns in `claude-code`), label-driven triage, and a search
  surface a later stage-2 `gh issue list --search` can use. Cost: it is the one
  surface `docs/agents.md` §0 tells agents never to touch, so the channel's
  credibility rests entirely on the human-gate discipline holding.
- **Discussions** — semantically correct for a "this felt wrong" signal, needs a
  one-line ops change, and keeps Issues PR-only so the §0 line stays
  unqualified. Cost: weaker prefill, weaker triage, no label-driven search.

This is a one-line ops change the maintainer can take independently of the code,
which is why it is a spike rather than a task in the plan.

## Acceptance

- [ ] Both surfaces are compared on: prefill fidelity (which query params survive), triage/label support, machine-searchable for stage-2 dedupe, and the §0 interaction.
- [ ] The recommendation is recorded as a comment on this item, with the deciding reason.
- [ ] If Discussions wins, the ops change is named exactly (one repo setting) so the maintainer can take it without the code.
- [ ] The answer feeds `task-friction-tier-b-url-and-optout`; that task is updated or its tier-B URL constant changed in the same PR that acts on the answer.
