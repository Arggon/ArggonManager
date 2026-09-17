---
type: bug
status: in_progress
id: bug-project-name-dir-derived
title: PROJECT_NAME derived from dir basename — init/doctor/propose renders wrong in worktrees and renamed clones
assignee: Arggon
branch: feat/bug-project-name-dir-derived
parent: story-adoption-state
labels: [p1]
created: "2026-09-17"
updated: "2026-09-17"
claimed_at: "2026-09-17T02:30:39.025Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/bug-project-name-dir-derived.md
  Leaves live only under a story. id is the filename stem: bug-project-name-dir-derived.
  CLI `arggon create bug project-name-dir-derived` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# PROJECT_NAME derived from dir basename — init/doctor/propose renders wrong in worktrees and renamed clones

## Context

Found during the init --propose pilot (2026-09-17, task-init-propose-acked-updates follow-up). `{{PROJECT_NAME}}` is resolved from the TARGET DIRECTORY BASENAME at render time. Every render-consuming surface is therefore wrong when run from a directory whose name differs from the canonical repo name — which is this repo's own modus operandi (one worktree per item, `../<repo>-<item-id>`):

- Evidence 1: `.editorconfig.proposed-0.2.0` generated in worktree `ArggonManager-pilot-absorb-proposals` contains the string "pilot-absorb" where the real repo name belongs.
- Evidence 2: `doctor` from worktree `ArggonManager-task-doctor-outdated-bucket` (PR #301 review) reported 10 outdated docs; from the primary checkout (`ArggonManager`) the true count is 7 — the 3 extra were project-name render drift, not upstream movement. Every out-of-primary run over/under-reports.
- Surfaces affected: `init` re-run regeneration (untouched docs rewritten with the wrong name), `init --dry-run` plan, `doctor` outdated bucket, `init --propose` side files.

For fresh scaffolds the dir name is a fine default. The bug is RE-RUNS on an already-initialized repo: the project name is already baked into the on-disk generated docs and should be recovered from there (or recorded in x-generated state), never re-derived from the current directory name.

## Acceptance

- [ ] On already-initialized trees, `{{PROJECT_NAME}}` (and any other dir-derived placeholder) is recovered from the existing generated content / recorded state; dir basename stays the fallback for fresh scaffolds only
- [ ] `init` re-run, `--dry-run`, `--propose` and `doctor` produce byte-identical results when run from a differently-named worktree/clone of the same repo vs the primary checkout (test: fixture initialized as `repo-x`, re-run from `repo-x-worktree-1` — zero spurious updates/outdated/proposals)
- [ ] The 2026-09-17 pilot measurements are re-taken post-fix (doctor from a worktree must report exactly the primary's 7 outdated)
- [ ] Docs updated where dir-derived placeholders are described (README init section)

## Notes

Related scope observations from the same pilot (not this bug's fix, decide separately): (a) `doctor` outdated walks x-generated state while `propose` walks the whole bundle (pre-provenance files like CONTRIBUTING.md get proposals but no outdated signal); (b) default propose scope is tier-1, `--full` adds tier-2 — documented but easy to miss; doctor has no tier filter. Also recorded: the pilot itself — all 11 proposals for our self-host docs were correctly REJECTED (generic templates vs curated content); see task-propose-section-backports for the follow-up idea.
