---
type: task
status: todo
id: task-author-methodology-productization-bodies
title: Author Context and Acceptance for the 12 open methodology-productization containers
parent: story-tracker-hygiene
labels: []
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-methodology-productization-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-methodology-productization-bodies.
  CLI `arggon create task author-methodology-productization-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author Context and Acceptance for the 12 open methodology-productization containers

## Context

The `methodology-productization` initiative subtree (initiative + 3 epics + 8 stories, all open) still carries scaffold-placeholder bodies — no Context, no Acceptance — as filed in `bug-template-only-bodies-ship-green`. An initiative with no stated Context cannot be reviewed for product acceptance, and stories with no Acceptance leave their leaves' purpose unstated. The 12 files (verified 2026-10-11):

- `methodology-productization` (initiative)
- `agent-role-model`, `external-agent-tooling`, `native-agent-adapters` (epics)
- `role-model-foundation`, `external-harness-evaluation`, `harness-research-transfer`, `story-adapter-selection`, `story-capability-matrix`, `story-opencode-adapter` (stories; `story-claude-adapter`, `story-methodology-carriers`, `story-zcode-adapter` already have content — verify, don't overwrite)

Source material (do not invent direction): ADR 0020 (methodology-first productization), ADR 0021 (role model), ADR 0022 (external-tooling decline), ADR 0026 (decision brief), spec-methodology-adapters-017, and each container's existing children titles.

## Acceptance

- [ ] All 12 open containers above carry a real `## Context` (why it exists, in one reader's plain words) and a real `## Acceptance` (what complete means — checkboxes only where the container can check them; prose where completion is the children's terminal state plus product-owner acceptance)
- [ ] No existing real prose is overwritten — the three stories with content keep theirs; additions only where placeholders stand
- [ ] Wording stays domain-neutral per ADR 0021 §6.2 (no new software-locked bars; software stays a worked example)
- [ ] `x-generated` untouched (these are tracker items, not generated docs); prettier clean; `arggon validate` green; PR opened with impact class Advisory

## Notes

### 2026-10-11 @ses_ed2ed434cffdHsqB0EV526IjUT
verdict: approve (10 container bodies, docs-only, smoke-exempt)
- Read the worktree diff (10 container index files + own item file, +168/-22) — no code/carrier/config; scope stays on the item
- Standards-reviewer: approve, no blocking findings; traceability to ADR 0020/0021/0022/0026 + spec-017 + children titles verified, domain neutrality verified, protected stories byte-identical
- Verifier: validate ok (0 warnings), prettier clean on all 10 files
- Lead calls: (1) task-body '12 containers' count is stale (tree holds 11 todo, 10 placeholders authored) — prose, not a scope error, left as history; (2) done-with-placeholder stories (methodology-carriers, zcode-adapter) stay untouched as history per the guard bug's exclusion; (3) PR impact class n/a is the compliant answer (impact class owed only by carrier PRs)
- Recommendation: merge PR #727 (merge, not squash); lead ticks Acceptance after merge and flips done
