---
type: task
status: todo
id: task-adr-readme-index-missing-adr-0020
title: "`docs/adr/README.md` has no row for ADR 0020 (methodology-first productization), which is Accepted on main"
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
