---
type: task
status: in_progress
id: task-native-lib-hygiene
title: "lib hygiene: commander types, workspace resolution, test/docs nits"
assignee: Arggon
branch: feat/task-native-lib-hygiene
parent: native-redesign
labels: []
priority: p2
created: "2026-09-20"
updated: "2026-09-21"
claimed_at: "2026-09-21T21:30:09.094Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-lib-hygiene
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-native-lib-hygiene.md
  Leaves live only under a story. id is the filename stem: task-native-lib-hygiene.
  CLI `arggon create task native-lib-hygiene` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# lib hygiene: commander types, workspace resolution, test/docs nits

## Context

Findings from the PR #374 review (`task-native-lib-package`, ADR 0013):

1. **MEDIUM** — `@arggon/lib`'s `.d.ts` import `commander` without declaring it
   in `lib/package.json` (consumer repro: `TS2307`). Runtime is dependency-free,
   but the public types leak it. Release-blocking for W6/W7.
2. **MEDIUM** — `npm test` and the child CLI require a prior `lib` build, and in
   worktrees with linked `node_modules`, `@arggon/lib` resolves to the
   **primary checkout** (repro: `ERR_MODULE_NOT_FOUND` when hiding `lib/dist`;
   the `start --worktree` link simulation resolves to PRIMARY). Follow-up in
   docs or `start` tooling.
3. **LOW** — the `rules.ts` identity test is tautological
   (`cli/src/lib.test.ts:19-22,146-153`).
4. **LOW** — `CONTRIBUTING.md`/README drift about `lib/`; ADR index rows
   0005–0009 pre-existing.
5. **INFO** — `lib/dist` compiles `*.test.ts` (excluded from the pack).

## Acceptance

- [ ] `commander` is either declared for types or removed from the public
      `.d.ts` surface; consumer type-check passes without undeclared imports.
- [ ] Worktree resolution: tests/CLI work in a linked worktree without
      resolving `@arggon/lib` to the primary (or the requirement is documented
      and enforced in `start`).
- [ ] `rules.ts` identity test asserts something non-tautological.
- [ ] Docs drift fixed (`CONTRIBUTING`/README about `lib/`).
- [ ] `lib/dist` excludes `*.test.*` (or the pack exclusion is documented).
- [ ] `lib/src/import-issues.ts` forwards `cwd` to `ghIssueListJson` (native
      calls currently resolve the repo from the server process cwd; `sync`
      already does it right).
- [ ] `arggon validate` green; CI green.

## Notes

- PO decisions still open: publishing/versioning of `@arggon/lib` (private
  until W6/W7) and the W2/W3 `templatesDir` injection requirement.
