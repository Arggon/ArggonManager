---
type: bug
status: in_progress
id: bug-harness-config-churn
title: harness-config-churn-blocks-start
assignee: Arggon
branch: fix/bug-harness-config-churn
parent: methodology-improvements
labels: []
priority: p3
created: "2026-09-30"
updated: "2026-10-01"
claimed_at: "2026-10-01T02:44:39.138Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-harness-config-churn
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-harness-config-churn.md
  Leaves live only under a story. id is the filename stem: bug-harness-config-churn.
  CLI `arggon create bug harness-config-churn` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# harness-config-churn-blocks-start

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-30 @Arggon
### Repro + evidence (this session, 2026-09-29)

`.zcode/config.json` is a **tracked** file that the ZCode harness rewrites during sessions (session state). `arggon start`'s clean-tree precondition refuses to run while it is dirty — three separate agent sessions today had to `git stash push .zcode/config.json` → `start` → `stash pop` before claiming an item (worker on `task-review-verdict-checker`, coordinator twice). A pushed-after-stash dance is exactly the manual tracker git work the tooling exists to remove, and a naive agent will instead commit harness state or `--force` its way through (both worse).

### Candidate fixes (triage needed)
- Untrack + gitignore `.zcode/` (it is per-machine harness state, not repo config) — check whether any tracked content is genuinely shared.
- Or: make the clean-tree precondition tolerate a configurable dirty-path allowlist (`x-tracker.clean-allowlist`?) so generated/harness churn doesn't block claims.
- Or: document the stash dance in the pitfalls reference (weakest fix).

### Acceptance checklist
- [ ] Decide the fix (untrack vs allowlist vs docs) — ADR not needed if untracking (no contract change).
- [ ] Implement + test (clean-tree precondition keeps protecting real edits).
- [ ] Verify a `start --worktree` succeeds with a dirty `.zcode/config.json` afterwards.
