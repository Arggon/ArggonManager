---
type: bug
status: in_progress
id: bug-init-ignored-artifacts-dirty-commit
title: arggon init leaves a dirty index when generated paths are gitignored (commit.skipped)
assignee: Arggon
branch: fix/bug-init-ignored-artifacts-dirty-commit
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T22:17:08.010Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-init-ignored-artifacts-dirty-commit
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/bug-init-ignored-artifacts-dirty-commit.md
  Leaves live only under a story. id is the filename stem: bug-init-ignored-artifacts-dirty-commit.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# argon init leaves a dirty index when generated paths are gitignored (commit.skipped)

## Context

Reproduced independently on a **fresh clone** of PR #331's head during the W7
dogfood review (and on all three `init` runs): `arggon init` reports
`commit.skipped: "git add failed: The following paths are ignored by one of
your .gitignore files:"` and leaves `M tasks/.convention.yml` **staged but
uncommitted** — a dirty index after a successful init.

Why it happens here: the OpenCode2 bundling ships derived copies that are
gitignored by design (`.agents/skills/**`, `.opencode/plugins/arggon/**`), so
the generation state (`tasks/.convention.yml`) updates while the tracked
`git add` for the auto-commit hits ignored paths. The same applies to any
adopter that gitignores a generated path.

## Acceptance

- [x] `arggon init`'s auto-commit stages only non-ignored paths (surgical
      staging is already the norm) and commits the state update without
      failing, **or** reports a precise non-failing status explaining exactly
      which paths were skipped and why.
- [x] No dirty index after a successful init on a tree with an ignored
      generated path (fixture test).
- [x] If the user-visible behavior changes, README/docs and the init JSON
      contract are updated in the same PR.

## Notes

- Surfaced by W7 (`task-opencode2-dogfood`); filed here per the review rule.
  Generic CLI behavior — reparent to a `cli`-owned story if maintainers prefer.

### 2026-09-18 @Arggon
## Fix (worker evidence)

**Root cause:** `commitTrackerMutation` staged every written path in one
`git add -- <paths>`. Git stages the non-ignored entries and THEN refuses the
batch on the ignored untracked paths ("The following paths are ignored…"), so
init's state update (`tasks/.convention.yml` + non-ignored docs) was left
staged-but-uncommitted with `commit.skipped` — the dirty index.

**Fix (`cli/src/tracker-commit.ts`):** the commit primitive now partitions
ignored paths out before staging with `git check-ignore --stdin -z`
(NUL-delimited, index-aware: a TRACKED path that matches a pattern still
stages normally), commits the remaining paths, and reports the skipped ones in
the additive `commit.ignored` array (root-relative posix, sorted). All paths
ignored → non-failing skip with reason
`all mutated paths are ignored by .gitignore` (never an empty commit, never
force-added). The human commit line carries `(N ignored path(s) skipped)`.
A check-ignore probe failure falls back to staging everything (pre-fix
behavior). JSON additive within `schemaVersion: 1`.

**Before** (fresh fixture, `.gitignore` = `.agents/skills/` +
`.opencode/plugins/arggon/index.ts`):

- `commit: { "skipped": "git add failed: The following paths are ignored by one of your .gitignore files:" }`
- `git status --porcelain`: 33× `A …` including `A tasks/.convention.yml`; `git log` empty (no commit).

**After** (same fixture):

- `commit: { "hash": "2de9077", "message": "chore(tasks): generated init docs (40 files)", "ignored": [<the 7 ignored bundles>] }`
- `git status --porcelain` → empty; HEAD = `2de9077 chore(tasks): generated init docs (40 files)`; `git ls-files tasks/.convention.yml` → tracked; `git ls-files .agents/skills` → 0.
- Re-init (fresh-clone shape: convention tracked, state rewritten, ignored bundles regenerated) → committed again, status clean.

**Tests:** init fixture test (fresh + re-init, exact `ignored` list, clean
`git status`, state file in HEAD) plus 4 tracker-commit primitive tests
(partial ignored commit + payload; all-ignored precise skip; tracked-ignored
path still stages; human line suffix). Full suite 1265 passed (75 files);
lint, build, `arggon validate`, `arggon spec validate` green.

**Docs:** README init paragraph, `docs/json-output.md` (init `commit` row +
tracker auto-commit paragraph), `docs/convention.md` §`x-tracker`.
