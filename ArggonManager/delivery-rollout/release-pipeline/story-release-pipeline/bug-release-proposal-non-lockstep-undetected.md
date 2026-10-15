---
type: bug
status: done
id: bug-release-proposal-non-lockstep-undetected
title: A non-lockstep auto-proposal is undetected in the maintenance run — and the lockstep assert runs after the tag
assignee: arggon-delivery-lead
branch: fix/bug-release-proposal-non-lockstep-undetected
parent: story-release-pipeline
labels: [release, ci]
created: "2026-10-13"
updated: "2026-10-13"
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

### 2026-10-13 @ses_eca4ef973ffeRAmpvyBGPnMWrE
### Prevention landed — PR #782 (maker)

All four open acceptance rows implemented on `fix/bug-release-proposal-non-lockstep-undetected` (commit cfded09a, PR #782). Item left `in_progress`; merge + done are the delivery lead's.

**Rows 1+2 — maintenance-run surfacing.** New `cli/release-lockstep-check.mjs` follows the `cli/release-abort-check.mjs` shape: injectable gh on `GH_BIN`, `--repo`/`GITHUB_REPOSITORY`, fail-closed when no repository, warn-and-exit-0 when gh cannot query/read (the pre-tag gate stays the backstop). It finds the open release PR on `release-please--branches--main` and reads both `package.json` versions AT that head ref via `gh api ...?ref=<branch> -H "Accept: application/vnd.github.raw+json"` (media type probed read-only against the live repo before coding). Verdicts: lockstep → exit 0 silent; no open PR → exit 0 silent; root != lib → exit 1 with both versions and the empty `Release-As: X.Y.Z` remedy (higher proposal). Wired into `release-please.yml` on every push, no `if:`, after the abort check and before the lockfile sync; workflow contract pinned by tests.
- `npx vitest run cli/release-lockstep-check.test.ts` → 13/13 (green, red, quiet, gh-failure, missing gh, unparseable, no-repo, argv pin, workflow contract).

**Live smoke — the check caught the defect live (read-only).** `node cli/release-lockstep-check.mjs --repo Arggon/ArggonManager` → exit 1 today on open release PR #770: `root (arggon-manager) 0.9.0 != lib (@arggondev/lib) 0.8.0` (main is lockstep 0.8.0/0.8.0). `gh pr checks 770` → "no checks reported" — its CI is still approval-gated, i.e. #770 is undetected exactly as #764 was. **Needs the product-owner remedy (empty `Release-As: 0.9.0` commit to main) before merge.** After this PR merges, a push to main while #770 is open reddens `release-please.yml` — the intended signal, but coordinate the order if a red run is unwanted.

**Row 3 — pre-tag lockstep.** `release.yml` split: new `Assert root-lib lockstep BEFORE tagging` sits beside the notes `--check` gate, before the tag step; `Assert tag-version agreement` stays post-tag. `cli/release-label-flip.test.ts`'s workflow contract was updated for the rename (tag → agreement → flip order unchanged).

**Row 4 — docs.** Root `release.md`: new §Exception: the release PR is non-lockstep (root != lib) — mechanism, both detection surfaces, the Release-As remedy, and the stranded-tag recovery (never move/delete the tag, clear the stuck label, fix lockstep forward with the next version). `ArggonManager/docs/runbooks/release.md` documents the same three points and points at the exception section.

**Gates (from the item worktree).**
- focused trio (`release-lockstep-check` + `release-label-flip` + `release-config-agreement`): 40/40 pass.
- `npm run build` then `npm test` → 3343 passed, 1 failed: `cli/src/provenance-audit.test.ts` "this repo's own committed seam has no ledger violations" → stale-checksum for `.agents/skills/arggon-cli/references/exploration.md` (gitignored derived copy). **Pre-existing on main, proven unrelated**: the record in `ArggonManager/.convention.yml` was generated 2026-10-13T02:56:53Z (arggon 0.7.0) and `skills/arggon-cli/references/exploration.md` changed at 10:36:04 today (d7dea8c5); my branch is byte-identical to main for both paths; fresh CI checkouts are green because `auditGeneratedProvenance` skips absent destinations (`cli/src/docs.ts:1675`), while the suite's `skill-copy.test.ts` regenerates the local copy. `npx vitest run --exclude cli/src/provenance-audit.test.ts` → 153/153 files, 3338/3338 tests, exit 0.
- `npm run lint` exit 0; `npm run test:structure` 5/5 exit 0; `npm run arggon -- validate` ok (0 warnings); `npx prettier --check` on all touched files clean; `actionlint` on both workflows exit 0.

**Open question for the lead.** #770's repair (Release-As: 0.9.0) is a product-owner act; recommend fixing it before this PR merges so no main push reddens the maintenance run (or accept the red as the designed signal). The stale `.convention.yml` checksum is unfiled work, out of this item's scope.

### handoff 2026-10-13 @ses_eca4ef973ffeRAmpvyBGPnMWrE (session: ses_eca4ef973ffeRAmpvyBGPnMWrE) — next: Delivery lead: get #770 repaired (product owner pushes empty `Release-As: 0.9.0` commit), review and merge PR #782, verify the merge, then flip the item done.
- branch: fix/bug-release-proposal-non-lockstep-undetected
- open questions: #770 is live non-lockstep (0.9.0/0.8.0): fix before merge or accept the designed red; pre-existing provenance-audit local failure (stale .convention.yml checksum) is unfiled.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as e3432290 (PR #782); auto-done flip landed. `cli/release-lockstep-check.mjs` (+13 tests) surfaces a non-lockstep open release PR as a red maintenance run, naming both versions and the Release-As remedy; the lockstep assert moved pre-tag in `release.yml` (tag↔commit agreement stays post-tag); the runbook documents the case, remedy and stranded-tag recovery. Green path quiet; "cannot check" warns and exits 0 with the pre-tag gate as backstop — the repo's established shapes.
Live proof: the check's first real run caught release PR **#770** (root 0.9.0 / lib 0.8.0) — awaiting the product owner's Release-As trigger; the pre-tag assert would refuse its tag.
Note: the local `npm test` provenance-audit failure is pre-existing and unrelated (stale derived skill-copy ledger — recorded on bug-skill-source-edit-leaves-ledger-stale); the maker proved CI-equivalence and the suite green in that state.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
### Second live pass — #770 (2026-10-13, delivery lead)
The shipped check earned its keep on its first day: it caught release PR #770 (root 0.9.0 / lib 0.8.0) live, exactly the class this item exists for. On the product owner's instruction the lead pushed the empty `Release-As: 0.9.0` trigger (599ed27d); release-please rebuilt #770 lockstep (0.9.0 == 0.9.0) and the maintenance run went green — abort check + lockstep check both pass. This time the `@arggondev/lib` pin carried **exact** (`"0.9.0"`, no caret): the one-time un-pin from the 0.8.0 release stayed sticky through the machine update, as predicted — no manual pin step was needed. #770 is CLEAN (cli/tasks-validate/ui-smoke green, head 3cc3513a); the merge remains the owner's click.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
### Shipped — v0.9.0 (2026-10-13, delivery lead)
#770 merged (20373133, squash) and release.yml run 38431048001 published it: tag v0.9.0 → **Assert root-lib lockstep BEFORE tagging** (the wave-3 hardening, first production run — pass) → tag agreement → GitHub Release with both tarballs → lib first → registry poll → CLI → assets. Verified: `arggon-manager@0.9.0` live (`latest`), `@arggondev/lib@0.9.0` live, and the exact kernel pin shipped automatically (`"@arggondev/lib": "0.9.0"` — the machine carried last release's un-pin with no manual step).
