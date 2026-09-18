---
type: task
status: todo
id: task-opencode-v2-plugin-hardening
title: "Plugin hardening: command-position parsing, storage guard order, cache keying (plus F3/F5/F6/F8)"
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode-v2-plugin-hardening.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-plugin-hardening.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin hardening: command-position parsing, storage guard order, cache keying (plus F3/F5/F6/F8)

## Context

Non-blocking findings from the independent review of PR #327
(`task-opencode-v2-plugin`, W3), filed here per the repo rule. The W3 code was
review-verified and merged; these are hardening items for the correlation and
session layers of `opencode/plugins/arggon/index.ts`.

- **F2 — correlation false positives.** `parseArggonItemFromCommand` scans every
  token, including quoted arguments: `grep -rn "arggon show task-x" .`,
  `echo "arggon update task-fake"` and `git commit -m "arggon handoff task-x"`
  all yield an item id. `parseArggonItemFromCode` can pick an `id:` inside a
  string literal. Impact: storage can override the branch; self-heals when the
  id does not exist, but a real unrelated id wins for the session.
- **F4 — storage writes before the tree guard.** `onToolAfter` writes
  `arggon/session/<id>` before the `tasks/` check, so "no-op outside trees"
  holds for injection but not for storage.
- **F5 — cache keying/eviction.** `itemCache` is keyed by item id only (two
  projects in one long-lived server can share an entry for ≤5 s on id
  collision); `itemCache`/`branchCache`/`renamedSessions` never evict.
- **F3 — `boundText` off-by-≤2 B on single-line multibyte input.** Not
  reachable through `buildItemBlock` (verified by brute force) but the helper
  contract should be hardened or documented.
- **F6 — stale comment.** `index.ts:38` references a test path that does not
  exist (`cli/src/plugin-context.test.ts`); the `boundText` docstring says it
  cuts on a line end while single-line input cuts mid-line.
- **F8 — smoke byte assertion.** The smoke parses the plugin's own reported
  byte count instead of measuring the injected text independently.

## Acceptance

- [ ] Command parsing anchored to command position (start, after `&&;|`,
      or after `npm run arggon --`), or the heuristic is explicitly documented
      as best-effort; tests cover the false-positive cases above.
- [ ] The `tasks/` tree guard runs before any storage write (no-op outside
      trees is literal).
- [ ] Cache keying/eviction decided and implemented (project-scoped key and/or
      bounded eviction); documented for long-lived servers (`opencode serve`).
- [ ] `boundText` hardened or documented with a test for the multibyte
      boundary; stale comments fixed.
- [ ] Smoke measures the injected block text independently (or logs it once
      with the reported size for cross-checking).
- [ ] Full suite + `smoke:opencode` green; small PR to `opencode2`.

## Notes

- F7 from the same review (T8's remaining assertions: skill discovery,
  agents/commands visibility, full next→start→done cycle) is tracked by the
  W4 orchestration item and `task-opencode-v2-plugin-import-gotcha`, not here.
