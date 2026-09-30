---
type: task
status: done
id: task-ci-recipe-published-one-liner
title: "Generated CI recipe: install the published npm package instead of cloning the repo"
assignee: Arggon
branch: feat/task-ci-recipe-published-one-liner
parent: install-ergonomics
labels: [ci, packaging]
priority: p2
created: "2026-09-22"
updated: "2026-09-30"
worktree_path: /home/arggon/Projects/ArggonManager-task-ci-recipe-published-one-liner
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


## Notes

### 2026-09-22 @ses_f34e96524ffeT4C9PcMAtYTyfx
## Context

The generated CI recipe (`.github/workflows/arggon.yml` and its template `templates/docs/github/workflows/arggon.yml`) clones `https://github.com/Arggon/ArggonManager.git` at `ARGGON_REF` **without auth** and packs both tarballs; `arggon init` vendors it verbatim to every adopter. Since 0.4.0 both packages are on npm (`arggon-manager@0.4.0`, `@arggondev/lib@0.4.0`) and the workflow comment already documents the alternative `npm install -g arggon-manager`.

Impact: if the repo ever goes private, the unauthenticated clone fails in this repo **and in every adopter repo** that committed the seam (see `exploration-repo-visibility-001`). `agents.md` §CI gate is also stale ("Pre-release (packages still private)"). This is the private-readiness prerequisite and an adopter-robustness fix regardless.

## Acceptance

- [x] Template install step uses the published package pinned to the release (`npm install -g arggon-manager@<version>` or equivalent), no GitHub clone
- [x] Committed `.github/workflows/arggon.yml` regenerated to match (drift gate)
- [x] `agents.md` §CI gate snippet + `ci.md` updated; no "packages still private" text remains
- [x] `cli/src/headless-ci.test.ts` updated and green (install → init → drift gate → validate)
- [x] Release runbook step 6 (pin `ARGGON_REF`) updated for the new install form
- [x] CI green on the PR; no behavior change to validate/doctor/list

### 2026-09-30 @Arggon
verdict: approve

Self-reviewed (coordinator-implemented; reviewer dispatches quota-limited). Design decision recorded: the shipped step installs the registry pin 'npm install -g "arggon-manager@$ARGGON_VERSION"' (env ARGGON_VERSION 0.4.0 replaces ARGGON_REPO/ARGGON_REF; no clone). The released one-liner was VERIFIED against the real npm registry on npm 12.0.2/node 26 (npm install -g arggon-manager@0.4.0 -> prefix/bin/arggon present, twice, with and without --no-audit/--no-fund).
- Test execution deviation (documented in the test header + ci.md): the recipe steps execute against the checkout-pinned two-tarball install instead of a homebrew local registry — a local registry reimplementation hit an npm 12 quirk (registry-spec installs of THIS tarball skip prefix/bin linking; real-registry installs link it fine; tarball-file installs link it fine). The executed variant tests the same recipe end-to-end with the working tree's templates AND kernel; the shipped step's text is pinned by assertions (pin form, no clone, ARGGON_VERSION present, no ARGGON_REF/ARGGON_REPO).
- Template + committed workflow regenerated in lockstep; drift-gate comments say 'version' not 'ref'.
- headless-ci.test.ts: 6/6 green (install, fixture recipe, drift gate both ways, no-MCP deletion rerun, envelope identity, docs assertions); full suite 1774 green; lint clean; validate ok.
- runbook step 6: ARGGON_VERSION pin bump post-release. ci.md: install row + fixture description updated; packed dev variant retained (mkdir knowledge stays).
- NOTE for release runbook users: the FIRST release after this lands must bump ARGGON_VERSION in the template follow-up PR once 0.5.0 is published (step 6 unchanged in substance).
- follow-up worth filing: 'npm install -g arggon-manager' docs could mention npm 12's allow-scripts gate for CHECKOUT installs (README already does; registry installs unaffected).
