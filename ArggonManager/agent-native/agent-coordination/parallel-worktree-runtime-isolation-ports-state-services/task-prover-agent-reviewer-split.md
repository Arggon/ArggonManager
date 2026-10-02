---
type: task
status: todo
id: task-prover-agent-reviewer-split
title: "Split execution evidence out of the reviewer: a shell-capable arggon-prover agent + a read-only reviewer contract"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam, methodology]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-prover-agent-reviewer-split.md
  Leaves live only under a story. id is the filename stem: task-prover-agent-reviewer-split.
  CLI `arggon create task prover-agent-reviewer-split` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Split execution evidence out of the reviewer: a shell-capable arggon-prover agent + a read-only reviewer contract

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Observed while reviewing PR #579: the reviewer agent tried to RUN bash commands (suites/probes) and could not — the review contract mixes two jobs. Diagnosis first: a live probe (`echo`, `git status`, `npm run arggon -- validate` through `arggon-reviewer`) shows all three SUCCEED today, so the project's `permissions` block is healthy again after bug-opencode-jsonc-malformed-permissions (the earlier blanket `Permission denied: shell` was the malformed config failing closed — the `explore` probe was separately blanket-denied by its own agent policy, which is a different mechanism). The real problem is the ROLE: a reviewer that runs gates burns its context on execution, races the worker's own runs, and (as here) can hit environment walls it then reports as findings.

So this is a role split, not a permissions fix:
1. NEW agent `arggon-prover` (`.opencode/agents/arggon-prover.md`, generated from `templates/docs/opencode/agents/`): shell ALLOWED for the gates a verdict needs (targeted vitest, lint, check:plugin, validate, the smokes), but `edit`/`subagent`/every mutating tracker tool denied and `git commit|push|merge|rebase` denied — it runs gates, it never changes the tree or history it is proving.
2. `arggon-reviewer`'s contract becomes explicitly read-and-reason: no suites, no builds, no smokes. When execution evidence is genuinely required it emits a `## Probes needed` block with the exact commands, and the coordinator routes those to the prover (or runs them itself) and pastes the evidence into the verdict.
3. agents.md documents the split so a future session routes by default, and the init seam test pins the new agent file so a future `init` keeps generating it.

## Acceptance
- [ ] `templates/docs/opencode/agents/arggon-prover.md` exists with the permission posture above (shell allowed; edit/subagent/arggon writes/git history writes denied) and an explicit output contract (command, expected vs observed, exit code, what it does NOT prove).
- [ ] `arggon-reviewer` no longer instructs itself to run tests, and defines the `## Probes needed` hand-off instead; its permission posture is unchanged (still read-only tree).
- [ ] This repo's `.opencode/agents/` regenerated from the templates (reviewer updated, prover created) and committed — `arggon init` must produce them from a clean scratch dir too (init test pinned).
- [ ] `ArggonManager/docs/agents.md` documents the split (who proves, who reviews) with the methodology impact class stated (Behavioral per ADR 0016: an agent's operating contract changes).
- [ ] Gates: npm test, lint, build, check:plugin, validate ok; CI green.

Open question for the reviewer of this item: should the ZCode marketplace mirror get the prover too (`.zcode-marketplace/arggon/agents/` currently has coordinator/reviewer/worker), or is the OpenCode-only prover right for v1? Record the answer in the item.
