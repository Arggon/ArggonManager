---
type: bug
status: in_progress
id: bug-tmp-fixture-leak
title: vitest fixtures leak mkdtemp dirs under /tmp (inode exhaustion breaks runs)
assignee: Arggon
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T21:15:15.785Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-tmp-fixture-leak.md
  Leaves live only under a story. id is the filename stem: bug-tmp-fixture-leak.
  CLI `arggon create bug tmp-fixture-leak` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# vitest fixtures leak mkdtemp dirs under /tmp (inode exhaustion breaks runs)

## Context

Found 2026-09-14 during the task-cascade-subtree-open-visibility cycle (lead-architect review round): `/tmp`'s inode table hit 100% from ~20k stale `arggon-*` mkdtemp dirs left behind by prior vitest runs, making the suite fail spuriously until the dirs were manually cleaned. Cascade test fixtures (cli/src/cascade.test.ts `chainTree()`, and possibly other fixture helpers) create mkdtemp dirs without removing them on exit.

## Acceptance

- [ ] Audit fixture helpers across cli/src/*.test.ts for mkdtemp usage without rmSync on exit; fix the leakers (try/finally or afterEach cleanup)
- [ ] One full suite run leaves zero new `arggon-*` dirs in /tmp (assert manually before/after; note the count in the PR body)

## Notes
