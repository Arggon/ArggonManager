---
type: task
status: done
id: task-convention-x-github-doc
title: "generated convention.md extensions table: document the new x-github namespace"
assignee: Arggon
branch: feat/task-convention-x-github-doc
parent: story-init-docs
labels: []
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-convention-x-github-doc.md
  Leaves live only under a story. id is the filename stem: task-convention-x-github-doc.
  CLI `arggon create task convention-x-github-doc` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# generated convention.md extensions table: document the new x-github namespace

## Context

Follow-up from the task-issue-roundtrip review (PR #228): the round-trip landed a new `x-github` namespaced extension (`issue-roundtrip`, default OFF), but the generated docs/convention.md extensions table (task-init-convention-extensions) does not list it — an adopter reading the generated convention doc cannot discover the gate.

## Acceptance

- [x] templates/docs/convention.md extensions table gains the `x-github` row (one line: issue round-trip on done, default OFF)
- [x] ArggonManager's own docs/convention.md matches (it is the normative reference the template points to)
- [x] init-docs extensions assertion covers x-github

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. The generated extensions table now lists x-github, and — the part I care most about — docs/convention.md gained the missing NORMATIVE x-github section (default OFF, degraded-close semantics, ignore-unknown rules), so the template's 'full reference' pointer actually holds. Extensions assertion extended by one key. Correct template-path correction (templates/docs/docs/). Merge follows.
