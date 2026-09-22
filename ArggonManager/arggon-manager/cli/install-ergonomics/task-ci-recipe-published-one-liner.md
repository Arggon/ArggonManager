---
type: task
status: todo
id: task-ci-recipe-published-one-liner
title: "Generated CI recipe: install the published npm package instead of cloning the repo"
parent: install-ergonomics
labels: [ci, packaging]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/install-ergonomics/task-ci-recipe-published-one-liner.md
  Leaves live only under a story. id is the filename stem: task-ci-recipe-published-one-liner.
  CLI `arggon create task ci-recipe-published-one-liner` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Generated CI recipe: install the published npm package instead of cloning the repo

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34e96524ffeT4C9PcMAtYTyfx
## Context

The generated CI recipe (`.github/workflows/arggon.yml` and its template `templates/docs/github/workflows/arggon.yml`) clones `https://github.com/Arggon/ArggonManager.git` at `ARGGON_REF` **without auth** and packs both tarballs; `arggon init` vendors it verbatim to every adopter. Since 0.4.0 both packages are on npm (`arggon-manager@0.4.0`, `@arggondev/lib@0.4.0`) and the workflow comment already documents the alternative `npm install -g arggon-manager`.

Impact: if the repo ever goes private, the unauthenticated clone fails in this repo **and in every adopter repo** that committed the seam (see `exploration-repo-visibility-001`). `agents.md` §CI gate is also stale ("Pre-release (packages still private)"). This is the private-readiness prerequisite and an adopter-robustness fix regardless.

## Acceptance

- [ ] Template install step uses the published package pinned to the release (`npm install -g arggon-manager@<version>` or equivalent), no GitHub clone
- [ ] Committed `.github/workflows/arggon.yml` regenerated to match (drift gate)
- [ ] `agents.md` §CI gate snippet + `ci.md` updated; no "packages still private" text remains
- [ ] `cli/src/headless-ci.test.ts` updated and green (install → init → drift gate → validate)
- [ ] Release runbook step 6 (pin `ARGGON_REF`) updated for the new install form
- [ ] CI green on the PR; no behavior change to validate/doctor/list
