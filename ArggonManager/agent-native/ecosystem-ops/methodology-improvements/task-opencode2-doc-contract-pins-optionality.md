---
type: task
status: todo
id: task-opencode2-doc-contract-pins-optionality
title: The opencode2 doc-contract test pins names/types/unions/caps/shapes but NOT optionality — while the doc intro promises optionality to the reader
parent: methodology-improvements
labels: [tests, docs]
created: "2026-10-03"
updated: "2026-10-03"
depends_on: [task-opencode2-payload-contract-preparation-fields]
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-opencode2-doc-contract-pins-optionality.md
  Leaves live only under a story. id is the filename stem: task-opencode2-doc-contract-pins-optionality.
  CLI `arggon create task opencode2-doc-contract-pins-optionality` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The opencode2 doc-contract test pins names/types/unions/caps/shapes but NOT optionality — while the doc intro promises optionality to the reader

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the reviewer of PR #609 (task-opencode2-payload-contract-preparation-fields), 2026-10-03, after it verified the new doc-contract test faithfully pins names, types, unions, caps and entry shapes against real seam runs.

**The gap.** That suite checks every property of the documented `preparation` receipt EXCEPT **optionality** — and optionality is precisely what the doc's own intro promises a reader. It correctly verifies the subtle cases (e.g. `steps?` is genuinely optional on the native surface because the projection omits an empty log, while the kernel type has it required; `env.keys` is fresh-write-only) — but by hand, in review, not in the suite.

So a future change that makes a documented-optional field always present, or a required field occasionally absent, would not fail the gate. The doc would drift on exactly the axis it advertises.

Two related nits from the same review belong with it: the doc's guarantee sentence is **absolute** where the suite's reach is **scenario-bounded** (it only proves what its seven scenarios exercise), and duplicate rows in the documented table are silently tolerated.

Acceptance:
- [ ] Optionality is pinned per field, derived from the real payloads across the scenarios — not hand-listed
- [ ] The doc's guarantee sentence is scoped to what the suite actually exercises, so an absolute claim is not made on scenario-bounded evidence
- [ ] A duplicate row in the documented table fails rather than being tolerated silently
- [ ] Extend the existing suite rather than adding a parallel one (it lives at `opencode/plugins/arggon/opencode2-doc-contract.test.ts`)
- [ ] Depends on PR #609 landing first
