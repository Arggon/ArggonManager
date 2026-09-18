---
type: bug
status: done
id: bug-atomic-write-followups
title: "atomic-write follow-ups: .convention.yml torn-write exposure + guard/mode nits"
assignee: Arggon
branch: fix/bug-atomic-write-followups
parent: story-self-improvement
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-atomic-write-followups
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-atomic-write-followups.md
  Leaves live only under a story. id is the filename stem: bug-atomic-write-followups.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# atomic-write follow-ups: .convention.yml torn-write exposure + guard/mode nits

## Context

Findings from the independent review of PR #339 (`bug-comment-torn-read`),
which made every item-file write atomic.

- **F3 — `tasks/.convention.yml` is still written in place** at three sites:
  `cli/src/init.ts:921` (initial write), `cli/src/docs.ts:961-963`
  (`applyDocsPlan` state rewrite), `cli/src/adopt.ts:713-723` (`adopt --ack`).
  Readers that can observe the truncate window: `readConventionConfig` throws
  on a torn/partial file (used by branch/list/view paths) and
  `readConventionVersion` silently degrades to version 0 on an empty read.
  Lower exposure than item writes (deliberate, infrequent mutations) but the
  same defect class — fixable with the same `writeFileAtomic` swap.
- **F1 — shrink guard can misfire under non-locking co-writers.**
  `cli/src/atomic.ts:31-38` re-stats the target after the rename and throws a
  misleading "refusing to leave a truncated doc" when a co-writer replaces the
  same path between rename and stat with a different-size file. Affected
  non-locking writers: the promotion `depends_on` rewrite
  (`cli/src/update.ts:682`), `priority migrate` (`cli/src/priority.ts:134`),
  and concurrent `create` of the same id. Cross-item lock scope is a separate
  pre-existing class; either make the guard tolerant of same-path replacement
  or extend the lock scope where feasible.
- **F2 — replacement resets mode/ownership and severs links.** A `0600` target
  becomes `0644` after `writeFileAtomic` (verified); hard links break. All
  CLI-created item files are default-mode today, so acceptable; optional
  hardening: stat the existing target and `chmod` the tmp before rename.

## Acceptance

- [x] The three `.convention.yml` writes use `writeFileAtomic`; a torn-read
      probe on the config path shows no partial observation; readers unchanged.
- [x] F1 decided and implemented: the guard tolerates same-path replacement, or
      the lock scope is extended where feasible (rationale recorded).
- [x] F2 decided: mode preserved (stat+chmod) or explicitly accepted.
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- None of this blocks; item-file writes are already atomic.

### 2026-09-18 @Arggon
## F1/F2 decisions + F3 evidence (worker)

**F1 — guard tolerance, not lock-scope extension.**
`writeFileAtomic` captures the temp file's `dev`+`ino` before the rename; the post-rename shrink guard now throws only while the path still holds that inode and the size mismatches. A non-locking co-writer's atomic rename inside the window (promotion `depends_on` rewrite, `priority migrate`, concurrent `create` of the same id) swaps the inode and is tolerated — the on-disk size then says nothing about our write. ENOENT after our own successful rename (co-writer moved/deleted the path, e.g. a reparent move) is tolerated the same way. When the inode is still ours, a short file still throws loudly (e.g. an in-place truncating writer touched it). Lock-scope extension was rejected for this item: promotion's tree rewrite and `priority migrate` are multi-item writers whose lock extension needs an ordered multi-lock protocol (architecture change), and `.convention.yml` has no lock at all; cross-item lost updates remain the documented separate lock-scope class.

**F2 — mode preserved.**
An existing target's permission bits are stat'ed and `chmod`'ed onto the temp file before the rename; new files keep the umask default. Ownership (needs privileges) and hard links (rename(2) semantics) are explicitly accepted — no CLI-created file relies on either.

**F3 — all three `.convention.yml` writers atomic.**
init scaffold (`cli/src/init.ts`), `applyDocsPlan` state rewrite (`cli/src/docs.ts`), and `adopt --ack` (`cli/src/adopt.ts`) now call `writeFileAtomic`; readers (`readConventionConfig`, `readConventionVersion`) unchanged.

**Evidence**

- Torn-read probe `cli/src/config-race.test.ts` (~1.2MB config; 3 tight-loop reader children vs 2 writer children x 8 iterations through the real paths):
  - pre-fix (call sites stashed back to `writeFileSync`): torn = **169** (init rerun) / **115** (adopt --ack) / **94** (init --force)
  - post-fix: torn = **0** in all three phases
- Guard/mode units `cli/src/atomic.test.ts` (10 tests): same-path replacement tolerated; move tolerated; in-place truncation still throws; 0600 preserved; fresh file = umask default.
- Delegation test `cli/src/atomic-config-writers.test.ts`: `fs.writeFileSync` is never called with the config path by the three writers; `writeFileAtomic` sees the scaffold/state/ack contents.
- Gates: `npm run build` ok, `npm run lint` ok, `npm test` 1172/1173 — the single failure is the known shared-machine `/tmp/arggon-budget-*` flake (another session's vitest creates those dirs; `measure.test.ts` passes 11/11 with a private `TMPDIR`). `arggon validate` ok, `arggon spec validate` ok.
- Branch `fix/bug-atomic-write-followups`, draft PR to `opencode2` next.

### handoff 2026-09-18 @Arggon (session: ses_f4ab32848ffeGpWnbmCAv9mN9e) — next: Coordinator: review draft PR #344 (https://github.com/Arggon/ArggonManager/pull/344), merge into opencode2, then flip the item done (acceptance checklist is complete).
- branch: fix/bug-atomic-write-followups
- open questions: None blocking; F1 lock-scope extension deliberately deferred as a separate architecture item if cross-item lost updates are prioritized.

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; the inode-capture guard was verified with fault-injection tests and the discrimination independently reproduced (post-fix torn 0/0/0; reverting the four source files yields 120/182/93 with 3 failing tests); mode preservation probed across 4 modes + umask defaults; all three .convention.yml sites delegate to writeFileAtomic and readers are untouched; no remaining direct writes; suite 1173/72 files with a private TMPDIR + CI green. Residual TOCTOU/symlink/read-only/fsync notes are documented and accepted. Closing.
