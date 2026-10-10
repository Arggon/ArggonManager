---
type: bug
status: done
id: bug-stale-x-generated-records-goal-mode-seam-pair
title: "Stale x-generated records: goal-mode seam pair"
assignee: arggon-delivery-lead
branch: fix/bug-stale-x-generated-records-goal-mode-seam-pair
parent: story-zcode-adapter
labels: []
created: "2026-10-09"
updated: "2026-10-10"
worktree_path: /home/arggon/Projects/ArggonManager-bug-stale-x-generated-records-goal-mode-seam-pair
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-zcode-adapter/bug-stale-x-generated-records-goal-mode-seam-pair.md
  Leaves live only under a story. id is the filename stem: bug-stale-x-generated-records-goal-mode-seam-pair.
  CLI `arggon create bug stale-x-generated-records-goal-mode-seam-pair` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Stale x-generated records: goal-mode seam pair

## Context

Found 2026-10-09 by the `task-zcode-automations` maker (PR #670) while regenerating the ZCode seam: on `main`, the `x-generated` provenance records in `ArggonManager/.convention.yml` for the goal-mode seam pair — `.zcode-marketplace/arggon/commands/arggon-goal.md` and `.zcode-marketplace/arggon/templates/goal-mode.md` — are STALE (left over from the goal-mode round-1 edit), so `arggon init` classifies both files `adopter-modified` and silently stops propagating template edits to them. The pair currently stays byte-synced with its templates only by luck (marker-stripped diff is empty today); the next template edit would be silently skipped on this repo's own seam.

The same defect class was found on two MORE records in the same sweep — `.zcode-marketplace/arggon/.zcode-plugin/plugin.json` and `.zcode-marketplace/marketplace.json` — and is repaired inside PR #670 (records brought back to the committed generator bytes, then init regenerated the copies itself, commit 7be1828b on that branch). The goal-mode pair was left out of that PR's scope and needs this item.

Repro on main: `node dist/cli.js init --dry-run` (after `npm run build`) lists both goal-mode files under `modified-skip … adopter-modified — kept`, and `sha256sum` of the committed copies disagrees with the `checksum:` recorded for them in `ArggonManager/.convention.yml`.

## Acceptance

- [x] Root cause named in this item: which write path produced the stale records (the goal-mode round-1 edit that changed the seam copies without refreshing `x-generated`), and why no gate noticed. — Named below ("Root cause"); the forensics corrected the original hypothesis: the records were not stale round-1 leftovers, they were **deleted** by a merge resolution.
- [x] The two stale records are corrected to the committed generator bytes (by `init` regenerating, or the same repair PR #670 used) — `init --dry-run` no longer lists either file under `modified-skip`. — Repaired with PR #670's remedy (records unlocked to the committed bytes `01c1b91c…`/`e3c44c94…`, then `node dist/cli.js init` regenerated the copies itself and re-stamped the records; the copies came out byte-identical). Verified: `node dist/cli.js init --dry-run` now classifies both files `updated` (`untouched since last generation`), zero `modified-skip` rows for either.
- [x] A machine check exists that would catch the class: records vs committed seam bytes verified somewhere a template edit cannot skip (doctor, validate, or an init/CI test), with a test proving it fires on a deliberately stale record. — `auditGeneratedProvenance` (cli/src/docs.ts) + `cli/src/provenance-audit.test.ts`. The repo-self test runs the audit against this checkout on every CI unit-lane run (a template edit cannot skip it); the fixture tests prove it fires on a deliberately stale checksum (`stale-checksum`) and on a deleted record (`missing-record`), and stays silent on adopter edits, acknowledged baselines and vendored plugin artifacts. Verified the negative too, corrected after standards review (the first version of this tick under-counted): with **origin/main's ledger** restored over this checkout, the audit reports **four** rows — the two goal-mode `missing-record`s plus TWO `stale-checksum` instances of the same class that PR #670 and this item's original scope both missed: `.opencode/commands/arggon-explore.md` (record `2c6faa1c…` vs committed bytes `e6f7d52b…`) and `.agents/skills/arggon-cli/references/json-contract.md` (main's record `4992d827…` vs `964c9ece…`, the bytes the current source renders — main's record predates 133ae844, which edited the skill source on main after the last seam regen). Both are repaired on this branch: explore in the same ledger rewrite; json-contract's record was refreshed to `964c9ece…` by the init regen commit b0950510 (the file is gitignored/untracked, `.gitignore:14`, so init created it in this worktree; the move `4992d827→964c9ece` is in b0950510, not the code commit 2778e22e). The json-contract row is visible only on checkouts where that untracked copy exists on disk — a fresh clone legitimately reports three rows, because the audit's `existsSync` guard skips absent destinations (both verified here: with the file hidden, main's ledger yields exactly the three rows; with it present, four).

## Root cause

Forensics on the actual history (traced 2026-10-09 on this branch, from `git log`/pickaxe over `ArggonManager/.convention.yml` and the seam paths):

1. Round 1 of `task-zcode-goal-mode` (6525798a, then 5fc8ddcc) introduced the goal-mode templates, the `.zcode-marketplace/` copies AND their `x-generated` records. Round 3 (954559b2 + regen 93ec81b5) refreshed both the copies and the records together — the branch's ledger was correct (`01c1b91c…` / `e3c44c94…`, exactly the bytes still committed today).
2. PR #641 (agent rename, 0d1571e0) landed on main from a branch cut BEFORE the goal-mode work merged; its `.convention.yml` never carried the goal-mode records.
3. **The write path that produced the defect:** the goal-mode branch merged origin/main at ab2f1d0e ("keep the agent rename (#641) intact") — its own message records "main's side wins on each" conflict. `.convention.yml` was one of those conflicts, and resolving it as main's side took main's LEDGER wholesale, silently dropping the branch's two goal-mode records — while the seam COPIES (`.zcode-marketplace/arggon/commands/arggon-goal.md`, `.zcode-marketplace/arggon/templates/goal-mode.md`) survived the merge unconflicted on their own paths. PR #605 (6bc995ba) then merged with both parents already record-less: main got round-3 copies with NO records for them.

So the item's original framing (records stale from the round-1 edit that changed the copies without refreshing them) described the branch-level coupling risk, but the loss on main was a **merge resolution of the single-file ledger dropping records whose destinations reached main on other paths**. Both shapes are the same failure class the new audit pins: the provenance ledger not describing the committed generator bytes.

4. **Why no gate noticed** (verified against the workflow): the `tasks-validate` drift gate regenerates with the checkout's own build and requires a clean tree — but it compares the committed COPIES against the generator's output and deliberately EXCLUDES `ArggonManager/.convention.yml` from its dirty diff (each run refreshes `generatedAt`); the copies stayed byte-identical to the templates (templates unchanged since round 3), so the gate stayed green. Its pinned-lag assertion reads only `arggonVersion` stamps — with the records gone there were no stamps to read. `arggon validate` checks the tracker tree, not the seam ledger; `doctor` reports `adopter-edited` for state-less files but is report-only. Nothing anywhere compared records vs committed bytes — which is exactly the gap `auditGeneratedProvenance` now closes.

## Notes

### 2026-10-10 @Arggon
verdict: approve
PR https://github.com/Arggon/ArggonManager/pull/673 merged in wave 2 (merge-order chain: stale records -> gate pattern -> lead role) after a standards-review approve and green CI.
Maker summary: merged https://github.com/Arggon/ArggonManager/pull/673; review approved; CI gate for https://github.com/Arggon/ArggonManager/pull/673
Item flipped done after merge.
