---
type: task
status: todo
id: task-review-bar-smoke-gate
title: "Review bar: non-functional dimensions + blocking smoke gate (ADR 0008)"
parent: story-dogfood-self-host
labels: [p2]
created: "2026-09-16"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-dogfood-self-host/task-review-bar-smoke-gate.md
  Leaves live only under a story. id is the filename stem: task-review-bar-smoke-gate.
  CLI `arggon create task review-bar-smoke-gate` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Review bar: non-functional dimensions + blocking smoke gate (ADR 0008)

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-16 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #298.

Verified: full diff read (engineering.md non-functional bar + blocking smoke section + testing-table row + UI row + Related link; agents.md coordinator paragraph + subagent expectation; ADR 0008 Accepted with alternatives from exploration 006; exploration flipped decided; SKILL nuance bullet; skills:sync run). Second commit closes a portability gap found in review: templates/docs/docs/engineering.md (the engineering.md init generates for adopting repos) carried the old bar — it now ships the non-functional dimensions and the smoke gate, phrased repo-agnostic so UI-rich adopters (ArggonStores-am) inherit the gate. Doctor: template edits are not checksum-managed docs (0 modified / 0 drifted, no ack needed); existing adoptions keep their generated copy and pick this up on their next methodology sync.

Gates: validate ok · doctor 0/0 · suite 999/999 · lint + build clean · skills parity green. Smoke gate applicability: this PR is docs-only + template — exempt by the bar it installs; no CLI/UI behavior changed, nothing to probe.
