---
type: task
status: todo
id: task-mcp-parity-branch-fails-pr610-spawnlane
title: "PR #610 `cli` failed via a `cli/src/cli.test.ts` stale-`lib/dist` module-export SyntaxError on its OWN run (37092949358) — a different spawn lane than the mcp-parity one already tracked"
parent: tooling-and-environment
labels: [ci, spawn-flake]
created: "2026-10-03"
updated: "2026-10-03"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-mcp-parity-branch-fails-pr610-spawnlane.md
  Leaves live only under a story. id is the filename stem: task-mcp-parity-branch-fails-pr610-spawnlane.
  CLI `arggon create task mcp-parity-branch-fails-pr610-spawnlane` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# PR #610 `cli` failed via a `cli/src/cli.test.ts` stale-`lib/dist` module-export SyntaxError on its OWN run (37092949358) — a different spawn lane than the mcp-parity one already tracked

## Context

PR #610's own `cli` run 37092949358 (commit `1f6ea622c`) failed in `cli/src/cli.test.ts` — not in `mcp-parity`. The reviewer of `task-adr0020-claude-seam-statement-stale` (F1, `ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr0020-claude-seam-statement-stale.md:112-120`) recovered the run log:

```
FAIL cli/src/cli.test.ts > CLI --json > arggon start --worktree refuses a fresh worktree whose stale install cannot provide the declared bin
SpawnHarnessError: [arggon-test-spawn] CLI spawn produced no result
kind: child-boot-failed (no CLI result — this is not an assertion failure)
SyntaxError: The requested module './convention.js' does not provide an export named 'CONVENTION_VERSION_DEFAULT'
  at lib/dist/json.js:1   (1 failed | 2274 passed of 2275)
```

That is a stale/partial `lib/dist` build-artifact boot race inside CI — the harness itself classifies it as not an assertion failure, and it cannot be caused by PR #610's diff (a markdown-only ADR amendment). The merge-blocking evidence was green regardless: head `b980a0d0b` → run `37093010908` `cli` pass plus `tasks-validate` pass. The failing test still exists at `cli/src/cli.test.ts:841`.

It is a different spawn lane than the one already tracked. `bug-mcp-parity-branch-test-json-parse-of-human-stdout` (fixed by PR #612) owns the `mcp-parity` reader defect — a bare `JSON.parse` of the MCP server's own tool-level error sentence. This instance fires in `cli.test.ts` with a module-export `SyntaxError` from the spawned child's ESM load of `lib/dist`: same trigger family (a spawn lane reading a drifting artifact under load), different file, different symptom, different fix surface. The same class is recorded with a sharper signature in `bug-cli-spawn-suites-exit-1-flake.md:141-163`, which names this exact recurrence across unrelated PRs (#610, #618 twice, plus the `mcp-parity` spawn lane). Per the reviewer's F1, a finding absorbed under the wrong id is a finding that gets lost — so this lane gets its own record rather than riding on the mcp-parity id.

## Acceptance

- [ ] The run-37092949358 evidence (commit `1f6ea622c`, the `cli.test.ts` failing test, the `convention.js` / `CONVENTION_VERSION_DEFAULT` `SyntaxError` stderr, the `child-boot-failed` classification) is recorded against this item, not the mcp-parity id
- [ ] Confirmed distinct from `bug-mcp-parity-branch-test-json-parse-of-human-stdout`: different file (`cli.test.ts` vs `mcp-parity.test.ts`), different symptom (module-export `SyntaxError` at `lib/dist` load vs bare `JSON.parse` of a tool error sentence)
- [ ] Disposition decided with a stated reason: folded into `bug-cli-spawn-suites-exit-1-flake` (same boot-race class) or kept standalone — and the decision is recorded here, not only in a PR comment
- [ ] No product change claimed on PR #610's account: its diff is a markdown-only ADR amendment, and the green head run (`37093010908`) is cited as the merge-blocking evidence
- [ ] Verified against the authorities named above — not against this item's prose

## Notes
