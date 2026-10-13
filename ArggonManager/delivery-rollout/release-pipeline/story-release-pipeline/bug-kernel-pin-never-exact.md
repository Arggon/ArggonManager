---
type: bug
status: in_progress
id: bug-kernel-pin-never-exact
title: Exact kernel pin was never established — every released arggon-manager ships a `^@arggondev/lib` range and nothing detects it (ADR 0018 §2 / spec A3 unmet since v0.4.x)
assignee: arggon-delivery-lead
branch: fix/bug-kernel-pin-never-exact
parent: story-release-pipeline
labels: [release, adopters]
created: "2026-10-13"
updated: "2026-10-13"
claimed_at: "2026-10-13T16:39:53.194Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-kernel-pin-never-exact
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-kernel-pin-never-exact.md
  Leaves live only under a story. id is the filename stem: bug-kernel-pin-never-exact.
  CLI `arggon create bug kernel-pin-never-exact` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Exact kernel pin was never established — every released arggon-manager ships a `^@arggondev/lib` range and nothing detects it (ADR 0018 §2 / spec A3 unmet since v0.4.x)

## Context

Found 2026-10-13 while sweeping the release pipeline after `bug-release-proposal-non-lockstep-undetected`.

**The recorded decision.** ADR 0018 §2 + spec-release-pipeline-015 invariant 4 / AC A3: the root's `dependencies["@arggondev/lib"]` in the release PR is **exact** (no `^`/`~`); the C1 amendment (2026-10-01, PR #555) established that release-please's `GenericJson` updater preserves the existing range prefix and named the escape hatch: **a one-time hand-unpin inside the FIRST release PR's review, machine-owned exact→exact from release 2** — claimed "documented in release.md" in both the spec amendment and `task-release-workflow`'s notes.

**What actually shipped.** Every released tag carries the caret, so the hand-unpin never executed (or never held):

| tag | root dependency |
| --- | --- |
| v0.4.1 | `"@arggondev/lib": "^0.4.0"` |
| v0.5.0 | `"@arggondev/lib": "^0.5.0"` |
| v0.6.0 | `"@arggondev/lib": "^0.6.0"` |
| v0.7.0 | `"@arggondev/lib": "^0.7.0"` |
| v0.7.1 | `"@arggondev/lib": "^0.7.1"` |

Current PR #764 repeats it (`^0.8.0`), so the live release would ship the caret again. `ArggonManager/docs/runbooks/release.md` does NOT mention the hand-unpin or the pin format at all (grep: zero hits) — the "documented" claim is false on both records.

**Impact.** The ADR rejected a runtime startup guard in favor of the exact pin so that "what an adopter installs is exactly what CI tested". With `^x.y.z`, npm may resolve a later kernel **patch** than the tested one (for 0.x, `^0.7.1` = >=0.7.1 <0.8.0) — the silent-skew surface ADR 0018 §2 says it rejects. Nothing detects the drift: no test, no workflow step, and A3 was "verified" once at spec time.

**Mechanism notes (why the escape hatch is fragile).** The `GenericJson` updater does a version-regex replace preserving whatever operator exists — exactness, once established, is sticky. But a manual edit pushed to the bot's PR branch is timing-fragile: release-please regenerates its branch on every update, so an early unpin can be clobbered. The robust place is the EXISTING PR-branch sync step in `release-please.yml` (it already checks out the branch, runs `npm install --package-lock-only`, and pushes), extended to normalize the range prefix + lockfile in the same push. Note: the spec explicitly REJECTED "a post-hoc caret-stripping step" on the grounds of a second writer fighting release-please's branch management — a rejection premised on the hand-unpin working, which four releases show it did not; revisiting it should be recorded as a spec amendment, not a silent change.

## Acceptance

- [ ] the root pin is EXACT on main and in the next release PR (`"@arggondev/lib": "X.Y.Z"`, no range operator); the fix lives in the existing `release-please.yml` PR-branch sync (machine-owned, idempotent under release-please updates) or a mechanism proven not to be clobbered, not a timing-fragile manual edit
- [ ] a guard detects a non-exact pin where it can still be fixed (release-PR run) and/or on main (test), so spec A3 is continuously enforced instead of verified once; a failure names the fix
- [ ] `release.md` documents whatever mechanism ships (the current "documented in release.md" claim is false — correct it) and the spec A3 / `task-release-workflow` record states what actually happened (hand-unpin never executed through v0.7.1)
- [ ] the live #764 release ships the exact pin — a one-time hand-unpin at merge time is tolerable only if the machine keeps it exact from the next release onward, and the spec's rejected-alternative note is amended accordingly
- [ ] if the owner prefers a range pin instead of exact, that is a recorded decision change (ADR 0018 amendment / superseding ADR), never a silent drift

## Notes

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
### One-time un-pin applied to the live release — 2026-10-13 (delivery lead)
While clearing #764 (see bug-release-proposal-non-lockstep-undetected), the lead applied the spec's one-time hand-unpin in the release PR before merge: root dependency `^0.8.0` → `0.8.0` (5fd10db4, lockfile re-synced; CI re-run green). #764 will ship the exact pin — the first release since v0.4.x to do so. From the next release onward the GenericJson updater preserves the absence of a range operator, so exactness is sticky.
Remaining on this item: the machine-owned normalization + guard, the `release.md` documentation, and correcting the spec A3 / task-release-workflow "documented in release.md" claims.

### 2026-10-13 @ses_ec9dcc298ffeLS5eOrNXTRs44z
### Implementation complete — PR #789 (branch `fix/bug-kernel-pin-never-exact`, commit 8264452c)

**Decision: guard only — no active normalization step ships.** release-please owns the pin rewrite, and exactness is sticky by construction: `GenericJson.updateContent` does a version-regex substring replace and preserves the operator already in the string (absence included). Observed on the real release PR #770: `"@arggondev/lib": "0.8.0"` → `"0.9.0"`, no operator. The lockfile-sync step cannot clobber it either — it stages only `package-lock.json`, and #770's merged commit shows only release-please's own `package.json` edit. A caret-stripping step in `release-please.yml` would be a second writer on release-please's own PR branch (the alternative spec C1 rejected) and would silently repair a release-please regression instead of surfacing it. What A3 lacked was detection, so the durable fix is the guard on both sides. Recorded in the spec C1 update and `release.md` §The kernel pin stays exact (guard-enforced).

**What shipped.**
- `cli/release-lockstep-check.mjs`: the existing release-PR check also reads `dependencies["@arggondev/lib"]` at the open PR's head ref (same `gh api ?ref=` call, no extra traffic) and reddens on non-exact (range operator), stale (exact but not the version being released) or missing pins, naming the value and the fix (edit `package.json` to the bare `X.Y.Z`, then re-run so the lockfile sync runs on the fixed branch). Version concern unchanged; gh failures still warn + exit 0.
- `cli/release-lockstep-check.test.ts`: caret/stale/missing/both red paths (20/20 in the file), a pure `pinProblem`/`pinFix` corpus, and a main-side test pinning the repo's own pin (A3 enforced continuously, not verified once).
- `release-please.yml`: step renamed `Surface a broken release PR (non-lockstep versions or a non-exact kernel pin)`; order unchanged (before the sync). Workflow contract test updated for the rename.
- `release.md`, `ArggonManager/docs/runbooks/release.md`, spec A3/C1, plus a correction comment on `task-release-workflow`.

**Live release check.** v0.8.0 tag: pin `0.8.0` (un-pin applied in its PR, 5fd10db4). v0.9.0 tag: pin `0.9.0` automatically — no manual step for v0.9.0.

**Gates (expected vs observed).** focused trio 47/47 pass; `npm test` 3353 pass + 1 pre-existing local-only failure (provenance audit on this worktree's gitignored stale `.agents/skills/arggon-cli/references/exploration.md` ledger — filed as bug-skill-source-edit-leaves-ledger-stale; CI-equivalent: the path is gitignored/`git ls-files .agents` → 0, and the suite is 6/6 green with the ignored copy moved aside); lint clean; test:structure 5/5; lint:structure clean; `arggon validate` ok; `spec validate`/`spec analyze --baseline` ok/0 new; actionlint clean; build + check:plugin clean. `prettier --check`: 5/6 touched files clean — the spec is red on pre-existing drift (59 lines, identical at HEAD; my inserted text is format-stable: `prettier(now) === prettier(HEAD) + edits`), left unswept deliberately, matching repo precedent (e.g. spec-deps-022 left drifted in a 47-line diff). No release triggered; the open release PR branch untouched.

**Documentation nuance for the record (differs from the item note's phrasing).** Checked against the tree at PR #555's merge (9abfca91): the one-time un-pin WAS documented in the repo-root operator manual `release.md` (§Exception, added in the same PR, 2f28e32f), so "documented in release.md" was true for that file; the canonical runbook `ArggonManager/docs/runbooks/release.md` never carried it (grep zero hits at that commit). What failed was execution + enforcement, not the writing — the spec correction and the task-release-workflow comment now state exactly that.

**Acceptance.** All four rows are satisfied by this PR + the recorded evidence: exact pin on main and in the release PR (0.8.0/0.9.0 shipped exact); guard on both surfaces with fix-naming failures; release.md/runbook/spec/task record corrected; live releases verified. Status left `in_progress` — completion is the delivery lead's call after merge.

### handoff 2026-10-13 @ses_ec9dcc298ffeLS5eOrNXTRs44z (session: ses_ec9dcc298ffeLS5eOrNXTRs44z) — next: Standards review + merge PR #789; then flip bug-kernel-pin-never-exact done (all four acceptance rows satisfied). No release trigger needed — guard is passive.
- branch: fix/bug-kernel-pin-never-exact
- open questions: Pre-existing spec prettier drift left unswept (5/24 specs drift; precedent says leave) — file a sweep item?; local provenance failure unchanged (bug-skill-source-edit-leaves-ledger-stale); doc-claim …
