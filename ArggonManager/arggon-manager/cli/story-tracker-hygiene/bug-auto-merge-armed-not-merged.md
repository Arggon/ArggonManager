---
type: bug
status: in_progress
id: bug-auto-merge-armed-not-merged
title: "Arming auto-merge is not ensuring merge: delivery-lead merge ownership ends at --auto instead of at MERGED"
assignee: arggon-delivery-lead
branch: fix/bug-auto-merge-armed-not-merged
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-18"
claimed_at: "2026-10-18T18:03:15.806Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-auto-merge-armed-not-merged
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-auto-merge-armed-not-merged.md
  Leaves live only under a story. id is the filename stem: bug-auto-merge-armed-not-merged.
  CLI `arggon create bug auto-merge-armed-not-merged` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Arming auto-merge is not ensuring merge: delivery-lead merge ownership ends at --auto instead of at MERGED

## Context

Filed by the delivery lead against its own loop, at the product owner's prompt ("second time, same mistake") after PR #731 sat CONFLICTING with auto-merge armed until the owner complained. The first instance was PRs #726/#727 sitting BEHIND for hours with `--auto` set.

The defect: the lead's merge step currently ends at `gh pr merge --auto --merge` — arming the merge — instead of at the PR reading MERGED. Auto-merge does not fire on DIRTY (verdict-comment/item-file conflicts, the routine shape: maker report vs lead verdict appended to the same item file), on BEHIND (base moved), or while checks re-run; each of those needs a hand (merge main in, resolve keeping both, push, re-verify). Arming and walking away converts every one of those into silent dwell, and the owner becomes the merge monitor — the exact inversion of the role table (`engineering.md` §Roles and authority: the delivery lead owns "merge verification and the `done` flip").

Contributing shape: verdict comments auto-commit to main, so EVERY reviewed branch conflicts on its own item file by construction. The loop manufactures the very state auto-merge cannot clear, then relies on auto-merge to clear it.

## Acceptance

- [ ] The delivery-lead loop gains a merge-ownership close-out: after arming auto-merge, verify MERGED (poll or re-check); on DIRTY/BEHIND, merge main in, resolve (keep report + verdict), validate, push, re-verify — never leave a reviewed PR unmerged without a named blocker on its item
- [ ] The rule is written where the lead reads it (`skills/arggon-cli/references/orchestration.md` and/or `ArggonManager/docs/agents.md` §Orchestration → Merge verification) with the impact class the methodology-change rule requires
- [ ] A `done` flip is refused-or-flagged while its PR is still OPEN (today the flip and the merge are two unlinked steps; the item can read done with the change unmerged)
- [ ] `arggon validate` green; prettier clean; `npm test` green for the touched surface; PR opened

## Notes

### 2026-10-18 @ses_eafd0e4ffffeBslXHAfWdTPHVB
Merge-ownership close-out implemented (PR #861, branch fix/bug-auto-merge-armed-not-merged, commit 570f4bcb).

Evidence (commands run, expected vs observed):
- `arggon validate`: ok (0 warnings, convention v5) — expected green, observed green.
- `npx prettier -- check` on touched files: clean.
- `npx tsc -p tsconfig.typecheck.json --noEmit`: clean.
- `npx vitest run cli/src/update.test.ts cli/src/done-gate.test.ts cli/src/sync-command.test.ts`: 82 passed.
- New tests in cli/src/update.test.ts (5): done flip refused when an open PR targets the branch; allowed when no open PR; graceful degradation without execGh; no-branch makes no gh call; gh-failure allows the flip.

Kernel change: lib/src/update.ts refuses flipping a task/bug to `done` while an open GitHub PR targets the item's branch, degrading gracefully when PR state can't be determined. Wired execGh into CLI (updateOperation + runUpdate) and MCP (arggon_update) entry points.

Docs: rule written where the lead reads it — skills/arggon-cli/references/orchestration.md and ArggonManager/docs/agents.md §Orchestration → Merge verification; one-line lesson in pitfalls.md. Skill copies + Claude template regenerated via skills:sync; .convention.yml provenance checksum refreshed.

Methodology impact: Behavioral (ADR 0016 adopter-upgrade channel) — adds a done-gate rule and PR guard.

Ready for the delivery lead's review + merge verification; the done flip stays the lead's call after the PR merges.
