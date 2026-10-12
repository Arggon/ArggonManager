---
type: bug
status: in_progress
id: bug-release-label-flip-verification-index-lag
title: "release-label-flip's post-flip verification reads the search index ~0.4s after the edit and can warn 'still pending' on a healthy release (observed live on v0.7.0)"
assignee: arggon-delivery-lead
branch: fix/bug-release-label-flip-verification-index-lag
parent: story-release-pipeline
labels: [release, ci, failure-mode]
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T22:10:25.913Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-release-label-flip-verification-index-lag
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-label-flip-verification-index-lag.md
  Leaves live only under a story. id is the filename stem: bug-release-label-flip-verification-index-lag.
  CLI `arggon create bug release-label-flip-verification-index-lag` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# release-label-flip's post-flip verification reads the search index ~0.4s after the edit and can warn 'still pending' on a healthy release (observed live on v0.7.0)

## Context

Observed live on the first real release since the label lifecycle landed
(2026-10-12, v0.7.0; release run 38296293861):

```
release-label-flip: flipped #744 chore: release main: 'autorelease: pending' -> 'autorelease: tagged'
release-label-flip: WARNING — still 'autorelease: pending' on 1 merged release PR(s) after the flip —
release-please WILL abort until they are cleared. The backstop reddens the next push naming them; manual recovery: …
```

Minutes later the live state was clean: `gh pr list --state merged --label
"autorelease: pending"` → `[]`, `#744` → `autorelease: tagged`. The flip had
succeeded; the **verification re-query hit GitHub's search-index lag**
(`gh pr list` is backed by search and is eventually consistent — the same lag
was observed by hand earlier the same day, where the query still returned a
just-flipped PR for a few seconds). The script's verification runs ~0.4 s after
the edit, so on a healthy release it can emit "release-please WILL abort" —
the crying-wolf shape this whole work stream exists to remove. A warning that
fires on every successful release trains readers to ignore the real one.

## Acceptance

- [x] The post-flip verification is authoritative or tolerates the search lag:
      e.g. verify per-PR via `gh pr view <n> --json labels` (not the search
      query), or retry the search query with a short bound — state which and why
      it cannot mask a genuinely stuck label
- [x] Tested: a healthy flip whose search re-read lags returns no warning; a
      genuinely stuck label still warns and names the recovery (pin both shapes)
- [x] The backstop's fail-closed behaviour is unchanged (unknown state elsewhere
      still reddens per its own contract); only the repair's self-verification
      changes
- [x] Offline proof of the false-positive fix: with a fake `gh` whose search
      query lags (its list still returns the PR as `autorelease: pending`) but
      whose authoritative per-PR read reports `tagged`, the run prints NO
      warning; with a PR genuinely still pending it still warns and names the
      recovery. (The opportunistic live re-check at the next release cut, when
      one occurs, is recorded in Notes — it does not gate this item.)

## Notes

### 2026-10-12 — maker: authoritative per-PR verification (offline-proven)

**Chosen shape.** The post-flip verification now reads each flipped PR back
authoritatively via `gh pr view <n> --repo <repo> --json labels`
(`viewLabels` / `stillPending` in `cli/release-label-flip.mjs`), one read per PR
immediately after its `gh pr edit`. The discovery query (`gh pr list --state
merged --label "autorelease: pending"`, release-please's own predicate, open PRs
excluded) is unchanged and is now commented DISCOVERY ONLY; the search query is
never re-read after an edit.

**Why it cannot mask a genuinely stuck label.** The verdict is the PR object,
not the index: `gh pr view` reads the PR itself and reports the edit
immediately, so "still pending" means the label really is on the PR — there is
no index lag between the edit and the read to excuse it. A read that fails or
returns an unreadable payload is counted as unverified (`could not re-query to
verify #n` per PR plus a "could not verify N" summary) and the run never prints
the green line: unknown state is never a green claim. A malformed discovery
entry stays in the warning set (fail closed for the warning, never the run),
preserving the defensive `#? (untitled)` renderer path. Exit 0 on every path,
the warning text, the manual-recovery line and the flip argv are unchanged.

**Tests** (`cli/release-label-flip.test.ts`, 15 → 18):

- new: a command-shaped fake `gh` whose `pr list` keeps reporting #744 as
  pending forever (the lag) while `pr view` reports `tagged` → **no warning**,
  the flip argv is the manual recovery, and the verdict came from `pr view`;
- new: under that same lagging search, `pr view` reports `pending` → warning +
  `#744` + the manual-recovery line (the lag cannot mask a stuck label either);
- new: an unreadable per-PR payload (`[null]`, exit 0) warns and never prints
  the clean-release line;
- updated mechanism pins: the flip test asserts call 3 is
  `pr view … --json labels` (no `pr list` after the edit); the `[null]`
  discovery-payload test keeps its defensive `#? (untitled)` contract; the
  failed-edit test now also pins that a failed edit's PR is read back and
  counted.

**Gates** (worktree; expected vs observed):

- `npx vitest run cli/release-label-flip.test.ts` → expected 18 passed;
  observed 18 passed.
- `npm run test` → first run, before `npm run build`: 3227 passed, 5 skipped,
  1 failed — `cli/src/headless-ci.test.ts` fails its own precondition ("run
  `npm run build` first": `dist/cli.js` absent in a fresh worktree), unrelated
  to this diff. After `npm run build`: 148 files, 3232 passed, 0 failed.
- `npm run test:structure` → 5 passed. `npm run lint:structure` → no findings.
- `npm run arggon -- validate` → ok (0 warnings, convention v5).
- `npx prettier --check cli/release-label-flip.mjs cli/release-label-flip.test.ts`
  → clean.
- `git diff --name-only` → only the script + its test (+ this item file):
  `release.yml`, `release-please.yml` and `cli/release-abort-check.mjs` are
  untouched, so the backstop's fail-closed contract is unchanged.

**Live re-check.** No release cut has happened since the defect, so the
opportunistic live re-check has not run; per the acceptance it does not gate
this item. At the next cut the step should print `OK — flipped N …` with no
`still 'autorelease: pending'` warning when the flip is healthy.

**Environment note (out of scope; reported only, not in this PR's diff).** This
worktree's session runs the workspace AutoHarness gate, which required a
validation harness for the input-handling surface this change touches. Left
behind, untracked and local-only: `.opencode/checks/release-label-flip-search-verification.ts`
(a pure checker that declines re-introducing a post-flip search re-query in
`cli/release-label-flip.mjs`), its labeled specs under `.opencode/specs/` and
the candidate copy under `.opencode/harness/candidates/`. It scores 1.0
(11/11 edit, 5/5 write) via the harness runner (`harness.grade`);
`harness.search` was unavailable (synthesis endpoint down), so the predicate
was hand-written and runner-adjudicated.

### 2026-10-12 @arggon-maker
Maker evidence — chosen shape and gates.

**Shape.** Authoritative per-PR read after each flip edit (`gh pr view <n> --repo <repo> --json labels`, `viewLabels`/`stillPending`); the discovery `gh pr list` query is unchanged and never re-read for the verdict. It cannot mask a stuck label because the verdict reads the PR object (no index lag to excuse it); a failed/unreadable read is reported as *unverified* and the run never prints the clean-release line on unknown state. Exit 0 on every path, warning text, manual-recovery line and flip argv unchanged.

**Tests.** `cli/release-label-flip.test.ts` 15 → 18. New: (1) command-shaped fake `gh` whose `pr list` lags forever while `pr view` says `tagged` → NO warning; (2) same lag, `pr view` says `pending` → warning + #744 + recovery; (3) a `[null]` per-PR payload (exit 0) → warns, never claims clean. Updated: the flip test pins call 3 as `pr view … --json labels`; the `[null]` discovery test keeps the defensive `#? (untitled)` contract.

**Gates (expected vs observed).**
- `npx vitest run cli/release-label-flip.test.ts` — expected 18 pass; observed 18 pass.
- `npm run test` — before `npm run build`: 3227 pass / 5 skip / 1 fail (`cli/src/headless-ci.test.ts` precondition “run `npm run build` first”, unrelated to this diff); after `npm run build`: 148 files, 3232 pass, 0 fail.
- `npm run test:structure` — 5 pass; `npm run lint:structure` — no findings.
- `npm run arggon -- validate` — ok (0 warnings, convention v5).
- `npx prettier --check cli/release-label-flip.mjs cli/release-label-flip.test.ts` — clean.
- `git diff --name-only` — the script + test (+ this item file); `release.yml`, `release-please.yml`, `cli/release-abort-check.mjs` untouched → backstop contract unchanged.

**Out of scope (reported only, not in the diff).** The workspace AutoHarness gate required a validation harness: left untracked at `.opencode/checks/release-label-flip-search-verification.ts` (pure checker declining a post-flip search re-query), graded 1.0 via `harness.grade` (11/11 edit, 5/5 write).

### handoff 2026-10-12 @arggon-maker (session: ses_ecdd4b43effe1CPjYSBDYyIwPG) — next: Standards review, then merge; at the next release cut confirm the log prints OK with no 'still pending' warning (opportunistic live re-check, not gating).
- branch: fix/bug-release-label-flip-verification-index-lag
- open questions: Whether the untracked local AutoHarness checker (.opencode/checks) should be committed repo-wide; live re-check pends the next release cut.

### 2026-10-12 @arggon-standards-reviewer
verdict: approve (per-PR authoritative post-flip verification; script + test + item file only)

Reviewed by reading (read-and-reason role; I executed no gates). Read: this item's Context/Acceptance/Notes/comments; the full PR #750 diff (4 commits, 3 files); `cli/release-label-flip.mjs` at head and at `origin/main`; `cli/release-label-flip.test.ts` at head (18 `it()`) vs main (15); `release.md` §The `autorelease` label lifecycle; the `release.yml` flip step; `ci.yml` `cli` job; `gh pr checks 750`; `gh pr view 750 --json files`; three-dot name-only. Worktree HEAD == PR head `a9fdd3d8`.

**Fix shape.** The post-flip verdict is `viewLabels` → `gh pr view <n> --repo <repo> --json labels`; `listPending` is defined once and called once (line 208), before any edit, its body byte-identical to main, now commented DISCOVERY ONLY — there is no post-edit search re-read. It cannot mask a stuck label: a readable `pending` verdict lands in `remaining` → the "still 'autorelease: pending' … WILL abort" warning naming the PR + recovery; a failed/unreadable read increments `unverified` → "could not re-query to verify #n" + "could not verify N …"; a malformed discovery entry is pushed to `remaining` (fail closed for the warning). The green line prints only when `remaining.length === 0 && unverified === 0`. `stillPending` is total (error/exit≠0 → undefined; JSON.parse in try/catch; `Array.isArray(parsed?.labels)`; `label?.name` optional-chained).

**Preserved contract.** Exit 0 on every path: every branch returns; `renderPending` (`pr?.number ?? "?"`), `stderrOf` and `(stdout || "")` are guarded; no uncaught-throw path found by reading. The "still pending" warning template and the MANUAL_RECOVERY line are byte-identical to `origin/main` (diffed); `flip()` argv unchanged and identical to the documented manual recovery; the discovery predicate (merged-only, limit 200) unchanged. One wording change is deliberate and necessary: the unverified-path warning is now per-PR plus a summary, replacing the old global "could not re-query to verify (stderr: …)"; the contract it carries (warn, never claim clean) is preserved and newly asserted with `stdout not.toContain("release-please is not aborting")`.

**Tests pin both directions.** 15 → 18, none deleted; the old malformed-verification assertions (`#? (untitled)`, "still … on 1") are re-homed in the new malformed-discovery test. Discriminating: the healthy-lag test (`pr list` lags forever, `pr view` = tagged) asserts stderr contains NO "WARNING" and stdout has the green line — without the fix call 3 is `pr list` → the lagging payload → WARNING → it fails. The flip test pins call 3 exactly `["pr","view","664","--repo","Arggon/ArggonManager","--json","labels"]`. Mirror: same lag, `pr view` = pending → warning + #744 + recovery. Unreadable: `pr view` exit 1 AND exit 0 with `[null]` both warn, both assert the clean line is absent. A failed edit is read back and counted ("still … on 1").

**Scope.** `gh pr view 750 --json files` == `git diff --name-only origin/main...HEAD` == the script + its test + this item file; `release.yml`, `release-please.yml`, `cli/release-abort-check.mjs` untouched → backstop fail-closed contract unchanged. Out of scope, disclosed by the maker: untracked local `.opencode/checks|harness|specs` in the worktree — not in the PR; report-only.

**Evidence.** Focused count matches the file (18). `gh pr checks 750`: cli pass, tasks-validate pass, ui-smoke pass; the `cli` job runs `npm run build` → `npm run test` → `npm run lint` → `test:structure`/`lint:structure` → spec analyze → smokes, so the after-build full-suite claim is corroborated by CI, not maker-only. Not executed by me: exact full-suite counts (the note's before/after arithmetic is loose — 3227+5+1 before vs 3232 after with skipped unstated; immaterial, CI green) and `prettier --check` (not wired in CI). Docs travel: the script header documents the incident and the authoritative read; `release.md` §The `autorelease` label lifecycle makes no claim about the verification mechanism and needs no edit; no stale doc found.

**Residual (non-blocking).** "gh pr view reports the edit immediately" is a GitHub-API mechanism claim resting on the offline tests + API semantics; the acceptance explicitly makes the live re-check non-gating. Confirm at the next release cut.

Confirmatory probes for the verifier (only a red first item would withdraw this approve): `npx vitest run cli/release-label-flip.test.ts` (worktree root) — expected 18 passed; read-only `gh pr view 744 --repo Arggon/ArggonManager --json labels` — expected the `{"labels":[{"name":"autorelease: tagged",…}]}` shape the parser consumes.
