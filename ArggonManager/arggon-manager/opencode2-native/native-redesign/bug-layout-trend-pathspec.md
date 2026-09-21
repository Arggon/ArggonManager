---
type: bug
status: in_progress
id: bug-layout-trend-pathspec
title: "report --trend: legacy tasks pathspec can mine an unrelated tasks/ dir"
assignee: Arggon
branch: fix/bug-layout-trend-pathspec
parent: native-redesign
labels: []
priority: p3
created: "2026-09-20"
updated: "2026-09-21"
claimed_at: "2026-09-21T21:38:54.449Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-layout-trend-pathspec
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-layout-trend-pathspec.md
  Leaves live only under a story. id is the filename stem: bug-layout-trend-pathspec.
  CLI `arggon create bug layout-trend-pathspec` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# report --trend: legacy tasks pathspec can mine an unrelated tasks/ dir

## Context

Post-merge residual from the PR #371 review (W0, `task-native-layout-rename`):

- `report --trend` on a v5 tree includes the legacy `tasks` pathspec so the
  history crosses the layout move. A v5 repo that happens to contain an
  **unrelated** `tasks/` directory with item-like frontmatter can then add
  false completions (reviewer repro: `{W38:1}`).
- Impact is limited to `--trend` and to that rare scenario; the primary v5
  path and the migrated repo are correct.

## Acceptance

- [ ] The legacy `tasks` pathspec is included only when its history records
      `tasks/.convention.yml` (or the dir is otherwise proven to be a legacy
      tracker), so an unrelated `tasks/` cannot contribute.
- [ ] Regression test: v5 tree + unrelated `tasks/` with item-like frontmatter
      → trend unchanged vs the no-`tasks/` baseline.
- [ ] Migrated-repo trend parity test (F1) still green.
- [ ] `arggon validate` green; CI green.

## Notes

- Filed immediately after the W0 merge per the review-findings rule; not
  blocking.
- Related: `task-native-layout-rename` (merged), `cli/src/trend.ts`.

### 2026-09-21 @Arggon
Fix implemented in worktree `/home/arggon/Projects/ArggonManager-opencode2-bug-layout-trend-pathspec` (branch `fix/bug-layout-trend-pathspec`, commit 45056fd, draft PR #383).

## What changed
- `lib/src/trend.ts`: the legacy `tasks` pathspec is now added only when the repo's history proves a legacy tracker — new helper `hasLegacyTrackerHistory()` runs `git log --format=%H -1 -- tasks/.convention.yml` and includes the pathspec only on a non-empty result (v5 layout; the legacy layout mines `tasks` directly as before). Probe errors are swallowed on purpose so the mining `git log` keeps the canonical `git log over <tracker>/ failed` / empty-history behaviour.
- `cli/src/trend.test.ts`: regression test (v5 + unrelated `tasks/`) and a focused positive test (plain `tasks/` -> `ArggonManager/` rename still mines the pre-move completion).
- `opencode/plugins/arggon/index.bundle.ts`: regenerated (`npm run build:plugin`), diff is exactly the trend change.

## Evidence
- RED before the fix (regression test): expected weeks `[W37:1]` / cycleTime `task 6.1 x1`, received `[W37:1, W38:1]` / `task 3.5 x2` — the reviewer's `{W38:1}` repro.
- GREEN after: 25/25 in `cli/src/trend.test.ts`, including the migrated-repo parity test (F1, `arggon migrate --layout`).
- Real-CLI smoke on a fixture (v5 tracker + committed unrelated `tasks/notes/task-fake.md`, item-like frontmatter):
  - before (primary checkout CLI): `{"weeks":[{"week":"2026-W37","completions":1},{"week":"2026-W38","completions":1}],"cycleTime":[{"type":"task","avgDays":3.5,"count":2}]}`
  - after (worktree CLI): `{"weeks":[{"week":"2026-W37","completions":1}],"cycleTime":[{"type":"task","avgDays":6.1,"count":1}]}`
  - positive direction, genuinely moved tracker (completion pre-move): `{"weeks":[{"week":"2026-W36","completions":1}],"cycleTime":[{"type":"task","avgDays":1,"count":1}]}` — the move is still crossed.
- Gates (worktree): `npm test` 89 files / 1456 tests green; `npm run lint` clean; `npm run build` ok; `npm run check:plugin` exit 0; `arggon validate` ok; `arggon spec validate` ok.

## Acceptance mapping
- [x] legacy pathspec only when history records `tasks/.convention.yml` (helper above).
- [x] regression test: v5 + unrelated `tasks/` == no-`tasks/` baseline.
- [x] migrated-repo trend parity (F1) green.
- [x] `arggon validate` green; CI green pending the PR run.
Left unchecked in the body so the coordinator closes it after CI/merge.

## Notes for the reviewer
- `docs/json-output.md` still says "a single `git log -p` pass" — the mining pass is still single; the probe is a separate `git log -1` existence check. No doc edit made (docs owned by a parallel worker); flag if you want the sentence to mention the legacy-pathspec guard.
- ADR 0008 smoke: covered above with a fixture repo (changed command `report --trend`), expected vs observed recorded.
- Known residual (accepted, out of scope): a repo with BOTH a real migrated tracker in history AND a later-committed unrelated `tasks/.convention.yml` would still be mined; the heuristic is the one the item prescribes.

### handoff 2026-09-21 @Arggon (session: ses_f3a17cb2affebfr36BKg1Dk5CZ) — next: Review draft PR #383 (commit 45056fd + tracker commit): confirm the probe heuristic in lib/src/trend.ts and the regenerated plugin bundle; then merge (merge commit, tracker-carrying branch) once CI i…
- branch: fix/bug-layout-trend-pathspec
- open questions: docs/json-output.md line ~489 still says the trend mining is 'a single git log -p pass' (still true; the probe is a separate git log -1) — docs are owned by a parallel worker, so the sentence was lef…

### 2026-09-21 @Arggon
CI green on PR #383: `cli` pass (2m26s), `tasks-validate` pass (34s) — https://github.com/Arggon/ArggonManager/actions/runs/35658926382 . All acceptance criteria now evidenced: history-proof pathspec gate, regression test vs baseline, migrated-repo parity (F1), `arggon validate`/CI green. Item left in `in_progress` for the coordinator to complete after merge.
