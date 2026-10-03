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

`tasks-validate` bootstrapped the tree with the **pinned released** bin
(`arggon init --no-commit`) and then required a clean `git status --porcelain`.
The comparison therefore answered "do the committed seam bytes match what
`ARGGON_VERSION` generates?" — correct for an adopter, structurally wrong for the
seam's own repo, where a feature PR legitimately **adds or edits generated
content**. Then the seam POSTDATES the pin: the pinned init rewrites the
committed bytes back (the state file still records them as "untouched since last
generation", so `init` regenerates rather than protects them), the diff goes
dirty, and the gate fails naming a seam that does not predate anything — with a
remedy (`run 'arggon init'`) that cannot work, since the pinned init is the very
thing deleting the new content. Reproduced verbatim on PR #605 and, in this
branch's evidence comment, against the shipped step bodies.

Mechanism in one line: `init` regenerates a destination whose recorded
`x-generated` checksum matches disk, so a seam that postdates the pin is exactly
the case the pinned generator overwrites.

The fix makes the gate **direction-aware** instead of release-gated: it compares
against the generator that owns the seam (the checkout's own build when the
checkout IS the seam's source, the pinned release for every adopter and fork) and
keeps the release protection as an explicit **pinned-lag assertion** — no
committed `arggonVersion` stamp may be NEWER than `ARGGON_VERSION`, because that
is the state in which the pinned install rewrites committed content (#527).

## Acceptance

- [x] A feature PR that legitimately changes generated seam content can go green: the gate compares against the BRANCH's own templates (init from the checkout), or exempts newly added destinations, or compares only files that existed at the pinned ref — **done, first option**: the drift gate bootstraps and regenerates with this checkout's own build (`npm ci --ignore-scripts` → `npm run build` → `node dist/cli.js init`) when the checkout is the seam's source; adopters keep the pinned path.
- [x] The message is directionally honest (it currently blames a seam that POSTDATES the ref) and prescribes a remedy that can work — each verdict now names the generator that disagrees plus the remedy for that direction, and the lagging-pin case reports the lag with the only working remedy (bump the pin) while naming "re-running the pinned init" as *not* the fix.
- [x] One coherent release story covering this AND the version guard that refused #600 — one root cause, one decision — `release.md` §One release story: two axes (shipped package identity = `cli/version-guard.mjs`, needs a release; repo-owned seam bytes = the drift gate, does not), the decision, and the price paid.
- [x] Decide and record: 'cut a release first' (an explicit, documented cost on every seam-touching PR) vs 'make the gate branch-aware' (no cost, weaker drift detection) — **branch-aware**, recorded in `release.md` §One release story, `ArggonManager/docs/ci.md` §Which generator the gate compares against and as an ADR 0018 amendment, with the weakening stated in the open: in this repo `tasks-validate` no longer proves the PINNED release reproduces the seam.
- [x] `templates/docs/github/workflows/arggon.yml` stays byte-consistent with the committed workflow — the gate exempts itself deliberately; do not break that exemption while fixing this — the two files differ only in the two action SHA pins (the repo copy is generated from the template, never hand-divided); the self-exemption and the `.convention.yml` `generatedAt` exclusion are kept and asserted, and the fresh-clone no-op (`git grep -q "arggon:generated"`) is unchanged.

Extra, not in the original list (found while proving the fix):

- [x] Both directions are provable: hermetic two-direction coverage in `cli/src/headless-ci.test.ts` plus a real probe (real build, real templates, the shipped step bodies) documented in `ArggonManager/docs/ci.md` §Reproduce the drift gate both ways.
- [x] A missing `dist/cli.js` is a hard error, never a silent fall-back to the pinned release (that fall-back *is* the bug).

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

### 2026-10-03 @Arggon
MISSING
