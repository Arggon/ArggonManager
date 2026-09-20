---
type: task
status: todo
id: task-native-kernel-lib-polish
title: "Kernel library polish: MCP note, write parity, re-exports, clean-build test"
parent: native-redesign
labels: []
priority: p3
created: "2026-09-20"
updated: "2026-09-20"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-native-kernel-lib-polish.md
  Leaves live only under a story. id is the filename stem: task-native-kernel-lib-polish.
  CLI `arggon create task native-kernel-lib-polish` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Kernel library polish: MCP note, write parity, re-exports, clean-build test

## Context

Non-blocking findings from the PR #372 review (`task-native-kernel-lib`, W1):

1. **MCP additive change** — `arggon_update` now returns `issueRoundtrip` and
   success `conventionVersion` from the detected tracker
   (`mcp-server.ts:457`, `operations.ts:337`). Aligns with docs; needs a test
   and/or an explicit note in the MCP contract.
2. **Committed parity covers reads only** (`lib-build.test.ts:57-66`): add
   2–3 write cases (create, update with cascade, comment/handoff).
3. **Missing re-exports for W2/W3**: `PriorityMigrateOptions`, `SyncFilled`;
   `HANDOFF_SESSION_CAP`/`parseCsvList` are still deep-imported in
   `mcp-server.ts:4,19`.
4. **Clean-build test** does not delete `dist` before building
   (`lib-build.test.ts:121`).
5. Informative: the surface is wide (~100 exports, incl. frontmatter
   primitives); document the stable subset the native tools rely on.

## Acceptance

- [ ] `issueRoundtrip`/`conventionVersion` covered by a test or documented in
      the MCP contract (`ArggonManager/docs/json-output.md` or equivalent).
- [ ] Write-parity cases committed (create, cascade update, comment/handoff).
- [ ] `PriorityMigrateOptions`/`SyncFilled` re-exported and `mcp-server.ts`
      free of deep imports for them.
- [ ] Clean-build test removes `dist` first.
- [ ] The stable export subset is documented.
- [ ] `arggon validate` green; CI green.

## Notes

- Filed per the review-findings rule; none blocked W1's merge.
- W2 (`task-native-tools`) will consume the same library surface, so land this
  before or with W2.

### 2026-09-20 @Arggon
Absorbed into task-native-lib-package (ADR 0013 kernel package restructure covers these findings).
