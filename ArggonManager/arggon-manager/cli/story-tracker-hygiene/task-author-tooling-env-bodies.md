---
type: task
status: todo
id: task-author-tooling-env-bodies
title: Author bodies for the 3 placeholder tasks under tooling-and-environment
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-tooling-env-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-tooling-env-bodies.
  CLI `arggon create task author-tooling-env-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author bodies for the 3 placeholder tasks under tooling-and-environment

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `tooling-and-environment`: task-file-smoke-opencode-red-on-main, task-mcp-parity-branch-fails-pr610-spawnlane, task-validate-missing-frontmatter-command-surface-assertions. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean; `arggon validate` green; PR opened

## Notes

### handoff 2026-10-12 @ses_ed22c74cfffeW3qD2qeuOZpagW (session: ses_ed22c74cfffeW3qD2qeuOZpagW) — next: Review the 3 authored bodies, merge feat/task-author-tooling-env-bodies, then complete the item
- branch: feat/task-author-tooling-env-bodies
- open questions: None; line-drift corrections disclosed in evidence comment

### 2026-10-12 @ses_ed22c74cfffeW3qD2qeuOZpagW
Maker evidence — bodies authored for all 3 files (commit 556c7074, pushed to origin/feat/task-author-tooling-env-bodies).

Files (all under ArggonManager/arggon-manager/cli/tooling-and-environment/):
- task-file-smoke-opencode-red-on-main.md — Context + 5 Acceptance boxes transcribed from its Notes (PR #611 reviewer, 47 failures, differential-vs-alone-run). Live Context cites ArggonManager/docs/agents.md:341 (current); Notes still read :295 (history untouched) — line drift disclosed.
- task-mcp-parity-branch-fails-pr610-spawnlane.md — NOTELESS (verified: empty Notes, no comments). Grounded in task-adr0020-claude-seam-statement-stale.md:112-120 (F1: run 37092949358, commit 1f6ea622c, cli.test.ts child-boot-failed SyntaxError), bug-cli-spawn-suites-exit-1-flake.md:141-163 (same boot-race class, recurring on #610/#618/mcp-parity lane), bug-mcp-parity-branch-test-json-parse-of-human-stdout (the already-tracked mcp-parity reader lane), cli/src/cli.test.ts:841 (failing test still exists). No product direction invented: Acceptance asks for evidence recording, lane-distinction proof, and a fold-vs-standalone disposition with reason.
- task-validate-missing-frontmatter-command-surface-assertions.md — Context + 5 Acceptance boxes transcribed from its Notes (PR #619 N1, runValidate-only gap). Live Context cites cli/src/validate.test.ts:82-96, :146-180 (command-surface precedent via runCli), json-output.md:299-307, .github/workflows/arggon.yml:38,50,146; Notes' pinned-0.5.0 restated as pinned-release mechanism (tree now pins 0.6.0) — drift disclosed.

Gates (worktree, before commit):
- npx prettier --check on the 3 files: expected clean → observed clean (was 3 pre-existing warns before edit: missing blank line after frontmatter / after dated Notes headings / before Notes Acceptance lists).
- npm run arggon -- validate: expected ok → observed ok (0 warnings, convention v5), pre- and post-edit.
- Full npm test NOT run (docs-only tracker change; no product surface touched).

Normalization disclosure: blank-line insertions only (after frontmatter, after dated Notes headings, before Notes Acceptance lists) — render-equivalent, same class as PRs #731/#732. Frontmatter untouched (no depends_on/labels rewrite). No Notes words/values/checkbox-states changed: git diff shows zero `-` content lines outside the two replaced scaffold placeholders per file. No live Acceptance box ticked by me. No file outside the 3 touched (git status confirms). No already-content file encountered: all 3 were still scaffold placeholders on read.

Tracker note: tools.arggon.show reads this item as status todo / unclaimed / no branch, while the dispatched worktree + feat/task-author-tooling-env-bodies branch exist and were used exclusively. Left as-is per no-reclaim rule; completion is the delivery lead's call.
