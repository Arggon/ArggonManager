---
type: task
status: todo
id: task-native-start-cold-smoke
title: Add native start cold-start smoke with a dependency-requiring pre-commit gate
parent: ui-foundation
labels: [opencode-seam, worktree, smoke]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
depends_on: [bug-native-start-worktree-no-install]
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-native-start-cold-smoke.md
  Leaves live only under a story. id is the filename stem: task-native-start-cold-smoke.
  CLI `arggon create task native-start-cold-smoke` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Add native start cold-start smoke with a dependency-requiring pre-commit gate

## Context

Add a durable cold-start smoke for the native worktree path after `bug-native-start-worktree-no-install` lands. The existing CLI integration coverage proves link preparation, but the native tool path has repeatedly created a cold worktree whose dependency-requiring pre-commit gate could not run and whose claim commit was silently absent. The smoke must exercise the real native `tools.arggon.start` domain seam, not re-test only the CLI helper.

## Acceptance

- [ ] Build a disposable git/OpenCode fixture whose primary checkout has a project install and whose fresh worktree starts without `node_modules`.
- [ ] Install an executable dependency-requiring pre-commit gate and a marker proving the gate ran; never bypass it with `--no-verify`.
- [ ] Invoke the actual native `tools.arggon.start` path and require an explicit readiness/claim-commit result, a present dependency preparation, and a claim commit containing only the item file.
- [ ] Re-run start and prove deterministic attach, no duplicate claim commit, and no mutation or emptying of the primary checkout install.
- [ ] Prove the smoke cleans every fixture/worktree process and writes only inside its disposable roots; any required `node_modules` report/receipt stays bounded.
- [ ] Add a deterministic repository smoke command and document how maintainers run it; keep the model-driven wave smoke separate.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, the new cold-start smoke, and `arggon validate` are green, with expected-vs-observed evidence in the PR.

## Notes
