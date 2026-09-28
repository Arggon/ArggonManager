---
type: task
status: in_progress
id: task-ast-grep-structural-rules-review-followup
title: Close ast-grep structural rule review gaps
assignee: Arggon
branch: feat/task-ast-grep-structural-rules
parent: ui-foundation
labels: [tooling, architecture, ci]
priority: p1
created: "2026-09-24"
updated: "2026-09-24"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ast-grep-structural-rules-review-followup.md
  Leaves live only under a story. id is the filename stem: task-ast-grep-structural-rules-review-followup.
  CLI `arggon create task ast-grep-structural-rules-review-followup` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Close ast-grep structural rule review gaps

## Context

PR #418 received a provisional **NO-MERGE** coordinator review on 2026-09-24:
https://github.com/Arggon/ArggonManager/pull/418

This follow-up covers the blocking rule-precision findings while implementation
continues in the existing `feat/task-ast-grep-structural-rules` worktree. The
native plugin source and generated bundle remain owned by the separate P1 worker
and must not be edited here.

## Acceptance

- [x] Narrow the native-tool exception to the actual `argonToolDefinitions` → catalog definitions → `editor.add` flow, with adversarial tests for extra adds, alternate registration, and second transforms.
- [x] Cover hand-authored TSX with explicit ast-grep language configuration and positive/negative TSX tests, including `tui.tsx` scan evidence.
- [x] Remove the bare `filePath` tracker false positive while adding destination/move and canonical literal/nested tracker-item positives.
- [x] Document and scope the structural-root-migration exception for `cli/src/layout-migrate.ts` and reconcile `cli/src/test-tmp.ts` / `cli/src/pack-fixtures.ts` helper scope without opening a production bypass.
- [x] Preserve the exact dev-only dependency, deterministic one-thread scan, existing CI wiring, no-rewrite behavior, and package allowlist.
- [x] Record adversarial rule/probe evidence and green focused/full test, lint, build, plugin, validate, diff, and package-surface gates.

## Notes

### 2026-09-24 @ses_f2b15dcecffeuVmXo3s1RGiJBJ

Follow-up implementation evidence (PR #418):

- Native rule now rejects extra `editor.add({...})`, wrong-shaped catalog adds, `ctx.tool.register`, and second transforms even when a function is named `registerArgonTools` and calls `argonToolDefinitions`; the sole allowed flow is the precise definition loop + spread/options payload.
- `sgconfig.yml` maps `.ts`/`.tsx` to the `Tsx` superset; inspect reports `opencode/plugins/arggon/tui.tsx` as `language=Tsx, appliedRuleCount=2`. TSX positive/negative tests are green.
- Tracker rule makes bare `filePath` valid, detects move destinations and nested/literal tracker paths, and keeps the one ADR-0012 layout migration suppression. Helper exclusions are explicit for `cli/src/test-tmp.ts` and `cli/src/pack-fixtures.ts`.
- Temporary adversarial probe returned both rule IDs and no finding for its valid bare-filePath TSX probe. Full gates and package-surface check are green; item remains in_progress for coordinator post-merge completion.

### handoff 2026-09-24 @ses_f2b15dcecffeuVmXo3s1RGiJBJ (session: ses_f2b15dcecffeuVmXo3s1RGiJBJ) — next: Coordinator: review PR #418 against the six checked follow-up criteria and merge; leave follow-up in_progress for post-merge completion.

- branch: feat/task-ast-grep-structural-rules
- open questions: None.

### 2026-09-28 second re-review remediation

The second review's P1s are addressed in the same item/worktree; no new tracker item was created.

- Native rule now uses explicit relational patterns: direct/optional/aliased `ctx.tool` calls, arbitrary alias declarations, identifier/factory `editor.add`, alternate namespaces, direct registration, extra loops, and forged `definitions` bindings with decoy calls are all rejected. The canonical exception requires the direct `definitions = argonToolDefinitions(...)` binding, direct `transform = ctx?.tool?.transform` binding, the `transform` call containing the `definitions` loop, and the exact add payload.
- Tracker mutation matching is position-specific: write/unlink/truncate inspect only the first path argument; a separate rule inspects only the rename destination path. Content arguments (`taskFileContent`, `value.filePath`) and generic `filePath`/`outputPath` are valid; `ArggonManager/docs` is excluded. Canonical literal/nested/dynamic item paths and member/identifier paths are covered.
- Full-config probe: exit 1 with 28 findings across all three rule IDs, all listed native/tracker bypass markers asserted, and no finding on the valid canonical/content markers. Probe removed.
- Final gates: `npm test` (95 files/1611 tests), `npm run lint`, `npm run test:structure` (3 suites), `npm run lint:structure`, `npm run build`, `npm run check:plugin`, native/CLI `validate`, Prettier, `git diff --check`, and package-surface check all green. Native plugin source and bundle remain untouched.
- Remaining exact limitation: a byte-for-byte identical duplicate call inside the already-recognized canonical loop is not distinguishable by ast-grep; ordinary identifier, factory, alias, namespace, loop, and forged-binding forms are covered.
