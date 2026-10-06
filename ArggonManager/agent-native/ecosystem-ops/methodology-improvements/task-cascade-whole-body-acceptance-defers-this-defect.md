---
type: task
status: todo
id: task-cascade-whole-body-acceptance-defers-this-defect
title: "Container cascade still judges the whole body, so a story with unticked history boxes never auto-completes — this fix's defect one level up, deferred without an item"
parent: methodology-improvements
labels: [done-gate, tracker-schema]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-cascade-whole-body-acceptance-defers-this-defect.md
  Leaves live only under a story. id is the filename stem: task-cascade-whole-body-acceptance-defers-this-defect.
  CLI `arggon create task cascade-whole-body-acceptance-defers-this-defect` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Container cascade still judges the whole body, so a story with unticked history boxes never auto-completes — this fix's defect one level up, deferred without an item

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
Filed from the review of PR #656. The reviewer found this deferral was **not recorded anywhere**, and `docs/engineering.md` §Definition of done 6 requires it to be.

### Context

PR #656 scoped the done gate's acceptance scan to the live `## Acceptance` section, excluding dated comment blocks. It deliberately left **container cascade** (`update.ts:1073`) on the old whole-body `acceptanceComplete`, on the grounds that containers are exempt from the done gate by ADR 0015.

That is coherent as a deferral — a container is not gated the way a leaf is — but it has a live consequence the deferral never named: **a story with unticked boxes in its dated history still never auto-completes.** That is the same defect PR #656 fixes, one level up: history vetoes a transition the current state satisfies.

The reviewer found a concrete live instance rather than a hypothetical: **`story-ci-wall-clock` — `liveCriteria=0`, `wholeUnchecked=5`.** The story has no live contract of its own and is vetoed on five historical boxes. So it is not theoretical.

### Acceptance

- [ ] Decide whether cascade should read the live acceptance region the way the leaf gate now does, or keep the whole-body question deliberately
- [ ] If it stays whole-body, the reason is recorded in the **carrier**, not only in a PR comment — and `story-ci-wall-clock` is either given a live contract or explicitly excepted with a stated reason
- [ ] Check the interaction with the acceptance-aware cascade rule in `convention.md:300` (containers are exempt there because their contract is the cascade) — confirm exempting them from the done gate does not silently give them a *different* acceptance question
- [ ] Verify against `docs/engineering.md` §Definition of done 6 rather than this item's prose, and confirm whether that deferral requirement was already unmet before PR #656
- [ ] Impact class stated per `docs/agents.md` §Changing the methodology
