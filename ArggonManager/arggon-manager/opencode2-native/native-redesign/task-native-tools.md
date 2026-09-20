---
type: task
status: todo
id: task-native-tools
title: Native arggon tool namespace
parent: native-redesign
depends_on: [task-native-lib-package]
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-tools.md
  Leaves live only under a story. id is the filename stem: task-native-tools.
  CLI `arggon create task native-tools` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native arggon tool namespace (W2)

## Context

W2 of `plan-native-first-011`. Register the `arggon` tool namespace with `ctx.tool.transform` (`options.codemode: true`) for list/create/update/show/next/report/validate/comment/handoff/priority and `sync`/`import-issues`, calling the kernel library in-process. Inputs/outputs mirror `docs/json-output.md`; kernel failures surface as typed tool errors.

## Acceptance

- [ ] Headless smoke (`opencode run`) calls every tool and gets contract-shaped results.
- [ ] Contract tests pin tool output ≡ `--json` envelope per command.
- [ ] A kernel error returns a typed tool error; the session continues (failure isolation).
- [ ] The namespace appears in the Code Mode catalog with the expected description.
- [ ] ADR 0006 tool-schema measurement re-runs and stays within budget.

## Notes

- Depends on W1. MCP parity matters only if the conditional adapter is built.
