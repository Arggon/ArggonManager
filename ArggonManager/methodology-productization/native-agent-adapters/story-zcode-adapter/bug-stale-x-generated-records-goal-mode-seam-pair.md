---
type: bug
status: todo
id: bug-stale-x-generated-records-goal-mode-seam-pair
title: "Stale x-generated records: goal-mode seam pair"
parent: story-zcode-adapter
labels: []
created: "2026-10-09"
updated: "2026-10-09"
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

- [ ] Root cause named in this item: which write path produced the stale records (the goal-mode round-1 edit that changed the seam copies without refreshing `x-generated`), and why no gate noticed.
- [ ] The two stale records are corrected to the committed generator bytes (by `init` regenerating, or the same repair PR #670 used) — `init --dry-run` no longer lists either file under `modified-skip`.
- [ ] A machine check exists that would catch the class: records vs committed seam bytes verified somewhere a template edit cannot skip (doctor, validate, or an init/CI test), with a test proving it fires on a deliberately stale record.

## Notes
