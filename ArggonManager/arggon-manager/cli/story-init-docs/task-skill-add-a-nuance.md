---
type: task
status: done
id: task-skill-add-a-nuance
title: "Skill: qualify the git add -A pitfall (gitignore-scope nuance)"
assignee: Arggon
branch: feat/task-skill-add-a-nuance
parent: story-init-docs
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-skill-add-a-nuance.md
  Leaves live only under a story. id is the filename stem: task-skill-add-a-nuance.
  CLI `arggon create task skill-add-a-nuance` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Skill: qualify the git add -A pitfall (gitignore-scope nuance)

## Context

The cuentas-claras adoption agent ran `git add -A && git commit` systematically
(136 times) despite the skill's blanket prohibition. Damage was zero there
(node_modules/dist are genuinely-ignored directories), but a rule agents see
violated without consequence trains them to ignore the rule. The pitfall is real
for ArggonManager-style worktrees, where `node_modules` is a SYMLINK to a shared
install: the `.gitignore` pattern `node_modules/` matches directories only, so
the symlink is untracked-but-NOT-ignored and `-A` commits it. That actually
happened in an ArggonManager init worktree, which needed an amend before push.

## Acceptance

- [x] SKILL.md pitfall states the rule's scope: it exists because infrastructure may be untracked-but-not-ignored (node_modules SYMLINK in ArggonManager-style worktrees; real incident, amend before push)
- [x] Nuance recorded: where such symlinks/infrastructure are absent and everything is properly gitignored, `git add -A` is lower-risk — but explicit paths stay the universal habit (also keeps unrelated dirty files out of your commit)
- [x] Pitfall points at tracker auto-commit surgical staging (`git add -- <path>` only, task-auto-commit-tracker) as the behavior agents should match in their own commits
- [x] SKILL.md version bumped 0.3.0 → 0.3.1 (patch: pitfall refinement)
- [x] templates/docs/AGENTS.md checked: no git-add mention → left untouched (the skill is the operational reference)
- [x] Copies synced and md5-verified: ~/.agents/skills/arggon-cli/SKILL.md and ~/Projects/arggon-cv/.agents/skills/arggon-cli/SKILL.md
- [x] Gates: `tsc -p tsconfig.json --noEmit` clean; `vitest run cli/src/init-docs.test.ts` 29/29 (template untouched, suite run as guard)

## Notes
