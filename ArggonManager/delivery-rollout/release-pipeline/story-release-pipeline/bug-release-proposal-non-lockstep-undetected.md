---
type: bug
status: in_progress
id: bug-release-proposal-non-lockstep-undetected
title: A non-lockstep auto-proposal is undetected in the maintenance run — and the lockstep assert runs after the tag
assignee: arggon-delivery-lead
branch: fix/bug-release-proposal-non-lockstep-undetected
parent: story-release-pipeline
labels: [release, ci]
created: "2026-10-13"
updated: "2026-10-13"
claimed_at: "2026-10-13T14:34:44.598Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-release-proposal-non-lockstep-undetected
---

<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-proposal-non-lockstep-undetected.md
  Leaves live only under a story. id is the filename stem: bug-release-proposal-non-lockstep-undetected.
  CLI `arggon create bug release-proposal-non-lockstep-undetected` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# A non-lockstep auto-proposal is undetected in the maintenance run — and the lockstep assert runs after the tag

## Context

Found 2026-10-13 investigating the red `cli` run on release PR #764 (run 38344325234 / job 115286782789): `cli/src/headless-ci.test.ts`'s packed-install leg fails with `npm error notarget No matching version found for @arggondev/lib@^0.8.0`.

**Mechanism, reproduced locally with the runner's npm major (10.9.4, probes under `/tmp/opencode/npm-tarball-probe2`).** `npm install -g <lib.tgz> <root.tgz>` dedupes an explicitly-passed tarball only when it satisfies the declared range. Packed root 0.8.0 declares `"@arggondev/lib": "^0.8.0"` while the packed lib is 0.7.1 → npm consults the registry → `ETARGET`. The test is correct; it is the first surface that caught a non-lockstep proposal.

**Root cause.** release-please auto-proposed 0.8.0 for the root only (the wave's `feat` commits touched no `lib/` path), and `release-please-config.json`'s `extra-files` rule rewrote the root's kernel dependency to the root's new version (`^0.8.0`) assuming lockstep — while lib stayed 0.7.1. Lockstep is the recorded invariant: ADR 0018 §1/§2, spec-release-pipeline-015 invariant 1 and the explicit non-goal "per-package independent releases — every release is lockstep". Previous auto-proposals (#744, #749) were lockstep only because both packages happened to have commits.

**Consequence if merged.** `release.yml` would create tag v0.8.0 and then fail `lockstep broken: root 0.8.0 != lib 0.7.1 — refusing to publish` — but the tag step runs BEFORE that assert, so the run strands a tag, the label flip (after the assert) never runs, and release-please wedges on an untagged merged release PR — the exact 2026-10-02 → 2026-10-07 outage class.

**Why the maintenance run does not surface it.** `release-please.yml` (action → abort-check → lockfile sync) never compares the open release PR's root/lib versions; the only red surface is the PR's own CI, whose runs start `action_required` and need a human to approve. #764 sat undetected until that approval.

**Remedy for the live PR (product-owner act — releases are human).** An empty commit with a `Release-As: 0.8.0` trailer forces BOTH packages to 0.8.0 (`CommitSplit includeEmpty: true`: an empty commit is applied to every component path). Verified with the pinned release-please (17.11.2) dry-run against a scratch branch: `updating from 0.7.1 to 0.8.0` twice, one combined PR — then release-please updates #764 to a lockstep proposal and CI can go green.

**Ruled out — do not re-explore.** The `linked-versions` plugin (the documented lockstep mechanism) is a no-op under this repo's tag contract: `Strategy.getComponent()` returns `''` whenever `include-component-in-tag` is false (v17.11.2 `strategies/base.js`), which spec invariant 1 and `cli/src/release-config-agreement.test.ts` pin — the plugin finds zero components. A config-only fix for auto-proposals does not exist in this version.

## Acceptance

- [x] `release-please.yml` surfaces a non-lockstep OPEN release PR as a red maintenance run (not only as the PR's approval-gated CI), naming both versions and the remedy (empty `Release-As: X.Y.Z` commit to main); logic in a tested, injectable-gh script per the `cli/release-abort-check.mjs` pattern
- [x] its test proves the green path (lockstep → exit 0, silent) and the red path (root != lib → non-zero, message carries both versions + remedy), injectable rather than live
- [x] `release.yml` asserts root-lib lockstep BEFORE creating/pushing the tag, so a broken release commit cannot strand a tag; the tag↔commit agreement assert stays after the tag as today
- [x] `ArggonManager/docs/runbooks/release.md` documents the non-lockstep case, the Release-As remedy, and the stranded-tag recovery if one ever lands
- [x] the live #764 state is recorded here once cleared (owner pushes the Release-As commit → #764 updates lockstep → CI re-approved and green)

## Notes

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx

### Resolution record — 2026-10-13 (delivery lead)

The product owner instructed the delivery lead to fix the failing release. Actions taken on that instruction (runbook step 1; merge remains the owner's click — releases are human by design):

- Lead pushed the empty `Release-As: 0.8.0` trigger to main (7d972ed5). Version 0.8.0 = the minor the convention derives (new adopter-facing features).
- release-please updated #764 to lockstep: root 0.8.0 == lib 0.8.0 (09f10bab + lockfile sync c58d8302).
- Release PR head 5fd10db4 is fully green: cli pass, tasks-validate pass, ui-smoke pass. Mergeable when checked.
  The durable-guard acceptance rows on this item (maintenance-run surfacing, pre-tag lockstep assert, runbook) remain open — they are prevention, not needed to clear this release.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx

### Released — 2026-10-13 (delivery lead, post-merge verification)

#764 merged (79a6ee6c, squash `chore: release main (#764)`). release.yml run 38404213674 — every step green: tag v0.8.0 → label flip (`autorelease: tagged`) → GitHub Release with both tarballs → lib published first → registry poll → CLI published → assets attached.
Verified independently: npm `arggon-manager@0.8.0` live (`latest`), `@arggondev/lib@0.8.0` live, and the exact kernel pin shipped (`"@arggondev/lib": "0.8.0"` — the first exact release since v0.4.x, see bug-kernel-pin-never-exact). The live-PR acceptance row is met; the prevention rows (maintenance-run surfacing + pre-tag lockstep assert + runbook) remain open.
