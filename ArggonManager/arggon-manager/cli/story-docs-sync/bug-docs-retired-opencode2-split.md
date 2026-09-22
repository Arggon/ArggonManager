---
type: bug
status: todo
id: bug-docs-retired-opencode2-split
title: Docs still claim the retired pre-0.4.0 main/opencode2 split
parent: story-docs-sync
labels: [docs]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-docs-sync/bug-docs-retired-opencode2-split.md
  Leaves live only under a story. id is the filename stem: bug-docs-retired-opencode2-split.
  CLI `arggon create bug docs-retired-opencode2-split` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Docs still claim the retired pre-0.4.0 main/opencode2 split

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34e96524ffeT4C9PcMAtYTyfx
## Context

Release 0.4.0 (tag `v0.4.0` = `394654f5` on main) shipped the native-first OpenCode V2 surface from **main**; the release checklist (`task-release-0-4-0`, step 3) merged `opencode2` → `main`. `opencode2` is now main + 2 tracker commits with **zero product diff**, and is being retired (`task-retire-opencode2`). The docs still describe the pre-release split:

- `ArggonManager/docs/opencode2.md` header: "shipped on the **opencode2** branch. `main` is untouched by product decision" + FAQ "Why is `main` untouched?"
- `README.md:106`: "what the `opencode2` branch adds"
- `ArggonManager/docs/agents.md` §CI gate: "Pre-release (packages still private)" + `git clone --branch opencode2` snippet (0.4.0 is published; `ci.md` already moved on)

## Evidence (2026-09-22)

- `git rev-list --left-right --count origin/main...origin/opencode2` → `0 2`
- `git diff --name-status origin/main origin/opencode2` → 1 file (tracker item only)
- `git merge-base --is-ancestor v0.4.0 origin/main` → yes; CHANGELOG `[0.4.0]` on main lists the whole surface

## Acceptance

- [ ] `opencode2.md` reflects reality: integration shipped in 0.4.0 and lives on main; add a short branch-retirement note; remove "main is untouched" claims
- [ ] `README.md:106` wording no longer presents `opencode2` as a live surface
- [ ] `agents.md` §CI gate snippet updated (published install; coordinate with `task-ci-recipe-published-one-liner`) and the "packages still private" note removed
- [ ] `ci.md` dev-checkout clone targets main or the pinned release tag, not `opencode2`
- [ ] `git grep -n opencode2` shows only historical/retirement references; `arggon validate --json` green
