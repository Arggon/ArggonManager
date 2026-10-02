---
type: bug
status: todo
id: bug-contributing-github-issue-contradiction
title: "CONTRIBUTING.md contradicts itself on GitHub issues (line 13 'not used' vs line 269 'open an issue')"
parent: story-adopter-feedback
labels: [docs]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/bug-contributing-github-issue-contradiction.md
  Leaves live only under a story. id is the filename stem: bug-contributing-github-issue-contradiction.
  CLI `arggon create bug contributing-github-issue-contradiction` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CONTRIBUTING.md contradicts itself on GitHub issues (line 13 'not used' vs line 269 'open an issue')

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @ses_f01eedccdffeKqUprfvF4gBa9M
verdict: approve

Evidence (read from branch fix/bug-contributing-github-issue-contradiction @ 5b576f39, PR #594, merge-base ecedac02):
- Scope is exactly 3 files per GitHub's three-dot diff: CONTRIBUTING.md, README.md, this item. No unrelated changes in the PR (the extra-file noise in a local two-dot diff is only because the branch predates other merges; merge-state is MERGEABLE/BEHIND, no conflicting overlap with main's todo-status version of this item).
- CONTRIBUTING.md:269 "Open an issue…" replaced with tracker work item (arggon create task … --parent <story-id>); README.md Contributing section likewise replaced with "Create a work item in the tracker (arggon create task)".
- Line 13 policy statement intact and singular: grep -c "GitHub issues are not used" CONTRIBUTING.md = 1.
- No "open an issue" instruction remains in CONTRIBUTING.md, README.md, SUPPORT.md, or templates/ (only remaining mentions are negated "Do not open GitHub issues" lines, which are the correct policy).
- Item acceptance checklist fully ticked with a dated evidence note in Notes (gates: arggon validate ok, npm run lint + lint:structure clean per the note; I did not re-run gates myself).
- Item frontmatter still in_progress on the branch — expected; coordinator flips to done on merge.

No blocking findings. OK to merge PR #594 and mark the item done.
