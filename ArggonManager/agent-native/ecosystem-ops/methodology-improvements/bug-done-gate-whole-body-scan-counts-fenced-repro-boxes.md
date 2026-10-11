---
type: bug
status: todo
id: bug-done-gate-whole-body-scan-counts-fenced-repro-boxes
title: "The done gate's box scan counts fenced repro content: a bug item whose repro legitimately contains `- [ ]` can never be flipped done, and the auto-flip wedge follows ADR 0025's \"dated comment blocks excluded\" only sometimes"
parent: methodology-improvements
labels: [spec-pipeline, kernel]
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-done-gate-whole-body-scan-counts-fenced-repro-boxes.md
  Leaves live only under a story. id is the filename stem: bug-done-gate-whole-body-scan-counts-fenced-repro-boxes.
  CLI `arggon create bug done-gate-whole-body-scan-counts-fenced-repro-boxes` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The done gate's box scan counts fenced repro content: a bug item whose repro legitimately contains `- [ ]` can never be flipped done, and the auto-flip wedge follows ADR 0025's "dated comment blocks excluded" only sometimes

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context (observed today, twice).** ADR 0025 says the done gate reads the item's LIVE `## Acceptance` section with dated comment blocks excluded, and refuses the flip when that section publishes no criterion. The kernel in this checkout behaves differently: it refuses any flip while the body file contains `- [ ]` anywhere.

Two sessions of evidence:
1. `task-spec-deps-022-no-error-path`: live Acceptance fully ticked, but my FILING COMMENT carried the same criteria unticked — flip refused ("still has unchecked boxes"). Ticking the comment boxes let it pass. So comment blocks are NOT excluded in practice.
2. `bug-prettier-glues-split-inline-code-span` (PR #707 merged, live Acceptance 6/6 ticked): the bug's own REPRO — a fenced markdown block demonstrating what prettier does to a `- [ ]` list item — contains three literal `- [ ]` lines. The flip is refused and the auto-flip wedge never fires. The fence is content, not criteria; without a gate fix this item can never reach done. (The checkbox is load-bearing for that repro: measured today, a plain `- ` bullet does not drift, so the repro cannot be simplified away.)

**Why it matters beyond hygiene:** the done gate is the repo's completion contract. A gate that reads fenced content as criteria will wedge exactly the items whose subject matter IS markdown-shaped — formatter bugs, tracker-shaped repros, docs items — i.e. the tracker eating its own dogfood in reverse.

Acceptance:
- [ ] The done gate's scan ignores `- [ ]`/`- [x]` inside fenced code blocks (the ADR 0025 live-section read is the contract; fences are content)
- [ ] The scan honors ADR 0025's "dated comment blocks excluded" — a `### <date> @author` block's boxes do not gate the flip (today they do, per evidence 1). Pick ONE rule and implement it; record which
- [ ] Tests cover: fence-embedded boxes, comment-block boxes, ticked live section with unticked comment (today's exact two shapes)
- [ ] `bug-prettier-glues-split-inline-code-span` flips done without a waiver and without editing its repro, once this lands (the item stays in_progress until then — honest state)
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok
