---
type: bug
status: in_progress
id: bug-seam-drift-gate-blocks-new-generated-seam-content
title: "`tasks-validate` drift gate installs the PINNED released arggon and diffs the committed seam, so any PR adding new generated seam content (e.g. the ZCode goal-mode template) fails until a release + ARGGON_VERSION re-pin"
assignee: Arggon
branch: fix/bug-seam-drift-gate-blocks-new-generated-seam-content
parent: tooling-and-environment
labels: [ci, release]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T02:11:11.966Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-seam-drift-gate-blocks-new-generated-seam-content
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-seam-drift-gate-blocks-new-generated-seam-content.md
  Leaves live only under a story. id is the filename stem: bug-seam-drift-gate-blocks-new-generated-seam-content.
  CLI `arggon create bug seam-drift-gate-blocks-new-generated-seam-content` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `tasks-validate` drift gate installs the PINNED released arggon and diffs the committed seam, so any PR adding new generated seam content (e.g. the ZCode goal-mode template) fails until a release + ARGGON_VERSION re-pin

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the coordinator on PR #605 (task-zcode-goal-mode), 2026-10-03 — CI evidence, not theory.

The `tasks-validate` job installs the **pinned RELEASED** package globally:

```
npm install -g "arggon-manager@$ARGGON_VERSION"   # 0.5.0
arggon init --no-commit
git status --porcelain ...   # any dirty generated file => "the committed arggon seam predates the pinned ref"
```

So the gate answers "does the committed seam match what the RELEASED version generates?" — the right question for drift, and structurally the wrong question for a PR that ADDS seam content. #605 adds two generated files (the ZCode `templates/goal-mode.md` and `commands/arggon-goal.md`) plus the two JSON descriptions naming them. The committed seam is now AHEAD of 0.5.0, the pinned init strips them, and the job fails:

```
the committed arggon seam predates the pinned ref — run 'arggon init' and commit:
 M .zcode-marketplace/arggon/.zcode-plugin/plugin.json
 M .zcode-marketplace/marketplace.json
```

The message is inverted for this case — the seam does not PREDATE the ref, it POSTDATES it — and the prescribed remedy cannot work, because the pinned 0.5.0 init is the very thing deleting the new files.

Same catch-22 as the released-version guard that refused #600's `adapters/` `files` change (0.5.0 already tagged). Third symptom of one root cause: **the release/pin cycle has no path for a feature PR that legitimately changes generated content.** `task-ci-seam-pin-tracks-release` is `done` and covers pin TRACKING, not this.

Repro: on any branch adding or editing a generated seam file (`.opencode/**`, `.zcode-marketplace/**`, `.mcp.json`, generated docs), push and read `tasks-validate`.

Acceptance:
- [ ] A feature PR that legitimately changes generated seam content can go green: the gate compares against the BRANCH's own templates (init from the checkout), or exempts newly added destinations, or compares only files that existed at the pinned ref
- [ ] The message is directionally honest (it currently blames a seam that POSTDATES the ref) and prescribes a remedy that can work
- [ ] One coherent release story covering this AND the version guard that refused #600 — one root cause, one decision
- [ ] Decide and record: 'cut a release first' (an explicit, documented cost on every seam-touching PR) vs 'make the gate branch-aware' (no cost, weaker drift detection)
- [ ] `templates/docs/github/workflows/arggon.yml` stays byte-consistent with the committed workflow — the gate exempts itself deliberately; do not break that exemption while fixing this
