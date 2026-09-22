---
type: task
status: todo
id: task-retire-opencode2
title: "Retire opencode2 after the 0.4.0 merge (carry the bug, docs, CI triggers, branch)"
parent: native-redesign
labels: [ci, docs]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-retire-opencode2.md
  Leaves live only under a story. id is the filename stem: task-retire-opencode2.
  CLI `arggon create task retire-opencode2` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Retire opencode2 after the 0.4.0 merge (carry the bug, docs, CI triggers, branch)

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34e96524ffeT4C9PcMAtYTyfx
## Context

`opencode2` = `main` + 2 tracker commits (`b94a64e0` created `bug-stale-vendored-plugin-copy`, `44a4b3fa` commented it) — the only open item in the tracker (284 items: 281 done, 2 cancelled, 1 todo). Zero product diff; the release merged the surface to main.

Product-owner decision (2026-09-22): carry the commits to main and retire the branch.

## Done this session (2026-09-22)

- Merge PR `opencode2` → `main` (merge commit, no squash — it carries tracker auto-commits) lands the stranded bug + this wave's filed items + `exploration-repo-visibility-001`.
- `origin/opencode2` deleted after the merge.

## Acceptance

- [ ] `bug-stale-vendored-plugin-copy` exists on main (was only on opencode2)
- [ ] `origin/opencode2` deleted; local worktree/branch cleanup documented (`git worktree list` / `git branch -d`)
- [ ] CI triggers no longer list `opencode2` in `.github/workflows/ci.yml` and `.github/workflows/arggon.yml` (template `templates/docs/github/workflows/arggon.yml` lands with the next release ref per the release runbook)
- [ ] Docs no longer present `opencode2` as a live surface (cross-ref `bug-docs-retired-opencode2-split`)
- [ ] Side-by-side installs section (`opencode2.md` §Side-by-side installs, `task-opencode2-side-by-side-installs`) marked historical or simplified
- [ ] `arggon validate --json` green

### 2026-09-22 @ses_f34e96524ffeT4C9PcMAtYTyfx
### 2026-09-22 @Arggon (coordinator)

Merge PR [#398](https://github.com/Arggon/ArggonManager/pull/398) (`opencode2` → `main`) carries this session's tracker commits, including `bug-stale-vendored-plugin-copy` (the stranded bug) and `exploration-repo-visibility-011`. `origin/opencode2` is deleted immediately after the merge lands.

Remaining acceptance (CI triggers in `ci.yml`/`arggon.yml` + template, docs sync, side-by-side section, local worktree cleanup) stays open — this item remains `todo` for that follow-up.
