---
type: story
status: done
id: story-github
title: GitHub integration
assignee: Arggon
branch: feat/story-github
parent: cli
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/story-github.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# GitHub integration

## Context

This repo tracks work in-tree under `tasks/`, not as GitHub issues; GitHub is for PRs only (see `docs/agents.md` §0). This story covers every point where the CLI meets GitHub, so that the git-native tracker and the PR workflow stay reconciled without manual bookkeeping:

- reading live PR state into the tracker (`sync`, `board --github`);
- pushing agent work to GitHub (`start` with claim → branch → push → draft PR);
- closing the loop automatically when PRs merge (auto-done workflow);
- resolving the acting user (`@me`) through GitHub identity.

## Acceptance

- [x] `arggon sync` reconciles open GitHub PRs into `tasks/`: check mode reports matched/unmatched, write mode fills empty `branch` fields only; never overwrites a set branch, never guesses an ambiguous match, never touches status.
- [x] `arggon board --github` overlays live PR state on cards that have a `branch` (read-only, one `gh pr list` call).
- [x] `arggon start --open-pr` claims the item, checks out its branch, commits, pushes, and opens a draft PR with the item id in the body.
- [x] `.github/workflows/auto-done.yml` flips claimed `task-*`/`bug-*` ids to `done` when a PR referencing them merges, and lands the flip via a squashed bot PR that carries the required `cli` check.
- [x] `@me` assignee resolution works via `GITHUB_USER`, then `GITHUB_ACTOR`, then `gh api user`.
- [x] Verified live in this repo on 2026-09-11 (`sync --check` and `board --github` both `ok:true`) with the full test suite green (22 files, 279 tests).

## Notes

- Landed incrementally: `board --github` in [#57](https://github.com/Arggon/ArggonManager/pull/57) (closing issue #51), `sync` in the PR closing #52, the auto-done workflow in [#79](https://github.com/Arggon/ArggonManager/pull/79) (with later CI fixes), and `--open-pr` shipped with `start`.
- Merge does not imply acceptance: `sync` and `auto-done` deliberately never change item status except the `auto-done` `in_progress → done` flip for referenced leaf items; humans/agents tick checklists themselves.
- `gh` must be installed and authenticated for `sync`, `board --github`, `start --open-pr`, and `@me` fallback resolution.
