---
type: bug
status: todo
id: bug-kernel-pin-never-exact
title: Exact kernel pin was never established — every released arggon-manager ships a `^@arggondev/lib` range and nothing detects it (ADR 0018 §2 / spec A3 unmet since v0.4.x)
parent: story-release-pipeline
labels: [release, adopters]
created: "2026-10-13"
updated: "2026-10-13"
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
