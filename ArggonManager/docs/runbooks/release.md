# Release runbook — publishing `arggon-manager` + `@arggondev/lib`

> **Superseded by automation (ADR 0018, `task-release-workflow`).** The manual
> bump/tag/publish procedure this page used to carry is gone: releases are now
> proposed by release-please and published by
> [`.github/workflows/release.yml`](../../.github/workflows/release.yml).
> **The operator procedure lives at the repo root
> [`release.md`](../../release.md)** — read it there. This page keeps only the
> invariants that outlive the automation.

## Invariants (still binding)

- **`CHANGELOG.md` is append-only** — a release adds its section at the top and
  never rewrites older sections (the release flow asserts it; older sections
  must stay byte-identical).
- **Never move or delete a release tag** — `vX.Y.Z` is the release of record;
  the CI guard fails loudly if a shipped version is re-shipped from a different
  commit, and re-tagging would break every pinned adopter install.
- **Never unpublish** — npm unpublish is off the table for released versions;
  a bad release is fixed by a new release.
- **Owner-only irreversible decisions** — npm publishes and GitHub Releases are
  owner-run or owner-configured (npmjs.com trusted publishers); everything else
  in the flow is automation.
- **The root kernel pin stays exact** — `dependencies["@arggondev/lib"]` carries
  the bare released version, no range operator (ADR 0018 §2;
  spec-release-pipeline-015 invariant 4 / A3). Exactness is sticky through
  release-please's extra-files rewrite and guarded on two surfaces:
  `cli/release-lockstep-check.mjs` reddens the maintenance run on an open release
  PR whose pin is not exact, and a test in the same file fails CI on a range pin
  on `main`. The fix lives in the release PR — see root `release.md`
  §The kernel pin stays exact (guard-enforced).
- **Merge the release PR by itself** — the guard classifies the pushed HEAD
  commit; a version bump buried under later commits in the same push silently
  strands the release (the bump never lands at HEAD).

## Version bump rules (for the release PR's changelog)

- **major** — convention/schema break: existing legacy `tasks/` trees need the
  `arggon migrate --layout` move to keep working.
- **minor** — new commands, new templates or template changes, methodology
  changes, or any new adopter-facing feature.
- **patch** — bug fixes with no adopter-facing surface change.

## Non-lockstep release proposals (both packages always release together)

release-please bumps only the components whose paths a wave touched, so a wave
with no `lib/` change can auto-propose a root-only bump — observed 2026-10-13 on
release PR #764: root `0.8.0`, lib `0.7.1`, with the root's kernel pin rewritten
to `^0.8.0` assuming lockstep. That proposal is broken: every release is lockstep
(root version == lib version; ADR 0018 §1/§2, spec-release-pipeline-015
invariant 1) and it must never merge.

**Detection.** `release-please.yml`'s `cli/release-lockstep-check.mjs` step
reddens the maintenance run on an open non-lockstep PR, naming both versions;
`release.yml` asserts root == lib **before** creating the tag, so a broken
release commit cannot strand a tag. A lockstep proposal and a push with no open
release PR stay silent.

**The red window is expected — not a pipeline failure.** Between releases, a wave
that leaves `lib/` untouched yields a root-only accumulating proposal (`chore`
commits are deliberately releasable; lib is bumped only when it has commits), so
this run reds on every push to `main` until someone decides the version. The red
means **"do not merge this PR yet — a Release-As decision is pending"**; it
clears by itself when the Release-As commit lands (release-please rewrites the
proposal lockstep and the next run exits 0 — observed on #786, 0.9.1/0.9.0 →
0.10.0/0.10.0). The check **stays a hard failure** by decision
(`task-nonlockstep-red-state-expectations`, 2026-10-13): a softer signal for this
case would repeat the shape of the 2026-10-02 → 2026-10-07 outage — a warning
inside a run that reported success — and an open non-lockstep proposal must not
merge whatever the reason. The merge-time protection is unchanged (`release.yml`'s
pre-tag assert) and the check's FAIL message carries the same reading.

**Remedy — force both packages with an empty `Release-As` commit.** An empty
commit is applied to every component path (`CommitSplit includeEmpty: true`), so
the trailer sets BOTH packages and release-please updates the PR to a lockstep
proposal:

```bash
git commit --allow-empty -m "chore(release): X.Y.Z" -m "Release-As: X.Y.Z"
git push origin main
```

`X.Y.Z` is the version you intend to release (normally the higher of the two
proposals; the red check message prints the concrete command).

**If a tag is stranded anyway** (a run from before the pre-tag gate): never move
or delete the tag and never publish from it — its versions disagree. Clear the
merged PR's stuck `autorelease: pending` label if the abort check names it:

```bash
gh pr edit <n> --add-label "autorelease: tagged" --remove-label "autorelease: pending"
```

then fix lockstep forward: force the NEXT version with the empty `Release-As`
commit above, merge that lockstep release PR, and let `release.yml` publish it.
npm skips the stranded number, and nothing points adopters at it.

Full operator detail: [`release.md`](../../../release.md) (repo root),
§Exception: the release PR is non-lockstep.
