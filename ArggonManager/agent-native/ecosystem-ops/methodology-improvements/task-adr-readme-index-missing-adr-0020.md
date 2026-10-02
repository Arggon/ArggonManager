---
type: task
status: todo
id: task-adr-readme-index-missing-adr-0020
title: "`docs/adr/README.md` index is missing ADRs 0005–0009 and 0020 (six rows), not just 0020"
parent: methodology-improvements
labels: [docs, adr]
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr-readme-index-missing-adr-0020.md
  Leaves live only under a story. id is the filename stem: task-adr-readme-index-missing-adr-0020.
  CLI `arggon create task adr-readme-index-missing-adr-0020` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/adr/README.md` has no row for ADR 0020 (methodology-first productization), which is Accepted on main

## Context

Found while reviewing PR #598: `ArggonManager/docs/adr/README.md` has no row for ADR 0020 (Methodology-first productization with per-agent native adapters), which is Accepted on main. The index therefore disagrees with the ADR directory.

## Acceptance

- [ ] README.md lists ADR 0020 with its title and status
- [ ] Every ADR file in the directory has an index row (sweep the whole dir, not just 0020)
- [ ] A test asserts index/directory parity so a new ADR cannot ship unindexed

## Notes

### 2026-10-02 @ses_f02ab5836ffeOAxmisboIwWE4x
Scope corrected by the reviewer of PR #598 (2026-10-02): the index is not missing only ADR 0020. Verified against the directory — `ArggonManager/docs/adr/` holds 0001–0020 plus README.md, and README.md indexes 0001–0004 and 0010–0019 only.

Missing rows: **0005, 0006, 0007, 0008, 0009, 0020** (six). The acceptance already says "sweep the whole dir, not just 0020" and requires an index/directory parity test, so this is a widening of scope, not a new problem — filing it as ADR-0020-only would have left five ADRs unindexed and the parity test would have failed anyway.
