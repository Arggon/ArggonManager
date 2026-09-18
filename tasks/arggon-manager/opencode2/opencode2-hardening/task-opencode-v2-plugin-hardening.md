---
type: task
status: in_progress
id: task-opencode-v2-plugin-hardening
title: "Plugin hardening: command-position parsing, storage guard order, cache keying (plus F3/F5/F6/F8)"
assignee: Arggon
branch: feat/task-opencode-v2-plugin-hardening
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T14:33:40.398Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode-v2-plugin-hardening
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

### 2026-09-18 @Arggon
**Hardening implemented — draft PR #337** (`feat/task-opencode-v2-plugin-hardening`)

Files: `opencode/plugins/arggon/index.ts`, `opencode/plugins/arggon/index.test.ts`, `smoke/opencode-smoke.ts`.

**F2 — command-position correlation.** `parseArggonItemFromCommand` resolves the arggon binary only in command position (segment start after `VAR=value` prefixes, or `npm|pnpm|yarn|bun run arggon …`); Code Mode `tools.shell({ command: "…" })` extracts the command string and parses it anchored; the `arggon_*` regex is documented best-effort. False positives before→after: `grep -rn "arggon show task-x" .` (task-x→undefined), `echo "arggon update task-fake"` (task-fake→undefined), `git commit -m "arggon handoff task-x"` (task-x→undefined), `echo arggon show task-x` (task-x→undefined), `cd repo && grep arggon show task-x` (task-x→undefined), embedded `tools.shell({command:'echo "arggon update task-fake"'})` (task-fake→undefined). True positives kept: `arggon show task-x`, `npm run arggon -- update task-x`, `cd repo && /usr/local/bin/arggon comment …`, `ARGON_QUIET=1 arggon show task-x`, `pnpm run arggon -- show task-x`, `tools.shell({command:"cd repo && arggon show task-x"})`, `tools.arggon.arggon_update({id:"task-x"})`.

**F4 — guard order.** `onToolAfter` returns before storage when the location is missing or `tasks/` is absent; new fake-ctx tests prove no `arggon/session/<id>` write outside a tree and the write inside one.

**F5 — caches.** `itemCache` keyed by `itemCacheKey(directory, id)`; `itemCache`/`branchCache`/`renamedSessions` bounded via `setBounded` (`CACHE_MAX_ENTRIES = 256`, oldest-first, re-insert refreshes); long-lived `opencode serve` rationale documented in code; tests cover project keys, eviction order and the default bound.

**F3/F6 — boundText + comments.** Decodes the longest valid UTF-8 prefix (fatal decoder, ≤3-byte back-off) so single-line multibyte cuts cannot overshoot; degenerate `max < marker` returns `{text:"", bytes:0, truncated:true}`; docstring fixed; stale `cli/src/plugin-context.test.ts` path corrected to `opencode/plugins/arggon/index.test.ts`.

**F8 — smoke cross-check.** Plugin logs `… (N bytes) block=<json>` (suffix only; `opencode-wave.ts`'s regex still matches); the smoke measures the logged text with `Buffer.byteLength` and asserts measured === reported and ≤ 1024 B in the branch/storage/env scenarios. Fixture evidence: `[arggon] context: injected item task-smoke-item (204 bytes) block="<arggon-item>…</arggon-item>"` → reported 204, measured 204, marker present.

**Gates.** `npm test` 1144/1144 (69 files; plugin file 23 tests, +9); `npm run lint` clean; `npm run build` clean; `arggon validate` ok (0/0); `arggon spec validate` ok (0/0); `npm run smoke:opencode` 11 scenarios / 0 failures (baseline before the change: 11/0).

**Docs not edited (reported).** `docs/playbooks/opencode.md` §Conventions W3 bullet should mention command-position anchoring (quoted `arggon …` arguments ignored; `arggon_*` regex best-effort), bounded/project-scoped caches, and the smoke's independent `block=` measurement.

### handoff 2026-09-18 @Arggon (session: ses_f4b101430ffeSOXIssuxq2Mw5r) — next: Review draft PR #337 against the item acceptance checklist (F2/F4/F5/F3/F6/F8), re-run npm test + lint + build + arggon validate + spec validate + smoke:opencode, then merge to opencode2 and close th…
- branch: feat/task-opencode-v2-plugin-hardening
- open questions: docs/playbooks/opencode.md W3 bullet update requested from the docs owner (command-position anchoring, best-effort arggon_* regex, bounded/project-scoped caches, smoke block= independent measurement)
