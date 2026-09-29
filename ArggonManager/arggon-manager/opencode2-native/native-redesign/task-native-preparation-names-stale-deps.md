---
type: task
status: todo
id: task-native-preparation-names-stale-deps
title: "Native start preparation payload should name a stale install's missing dependencies"
parent: native-redesign
labels: [opencode-seam, worktree, install]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-native-preparation-names-stale-deps.md
  Leaves live only under a story. id is the filename stem: task-native-preparation-names-stale-deps.
  CLI `arggon create task native-preparation-names-stale-deps` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native start preparation payload should name a stale install's missing dependencies

## Context

Found while fixing `bug-worktree-readiness-misses-stale-primary-install` (PR #429), which
taught the shared preparation receipt to distinguish "a linked install is present" from
"the install provides what the worktree's own `package.json` declares" and to name what is
missing. The kernel receipt (`prepareWorktreeDependencies` in `lib/src/worktree.ts`) now
carries `manifestCoverage`, `missingDependencies` and `missingDependenciesTotal`, and the CLI
surfaces all three in `arggon start --worktree --json` and on stdout.

The native `start` payload is a *projection* of that receipt, and the projection lives in the
plugin (another worker's file in that wave): `boundedPreparation` in
`opencode/plugins/arggon/index.ts` lists its fields explicitly, so it forwards `ready` (which
now carries the new clause, unchanged by this task) but drops the three new fields. A native
caller therefore learns "not ready" without learning *what* is missing — the same gap the CLI
side just closed. Native start is the surface where the bug was originally measured.

## Acceptance

- [ ] `NativePreparationReceipt` carries `manifestCoverage`, `missingDependencies` and
      `missingDependenciesTotal`, projected from the kernel receipt the same way the existing
      fields are (never re-derived in the plugin).
- [ ] The bounded projection keeps the payload bounded: cap `missingDependencies` with the
      existing `MAX_NATIVE_PREPARATION_NAMES` (and fold a truncation into the existing
      `truncated` flag) rather than forwarding the kernel list as-is.
- [ ] The `preparation` payload's documented field list (`ArggonManager/docs/agents.md`
      Native `start` dependency contract, `ArggonManager/docs/opencode2.md` payload table) and
      `opencode/plugins/arggon/tools.test.ts` are updated in the same change.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`,
      `npm run lint:structure`, `npm run test:structure` and `arggon validate --json` are green.
- [ ] `opencode/plugins/arggon/index.bundle.ts` is regenerated (`npm run build:plugin`) — it
      inlines `@arggondev/lib`, and the plugin was not editable in that wave.

## Notes

p3: the native surface is already honest (`ready: false` for a stale mirror); this only makes
the remedy actionable there, as it now is on the CLI.

### 2026-09-29 @Arggon
Superseded by PR #429 (branch fix/bug-worktree-readiness-misses-stale-primary-install, commit 550f3575): the native `preparation` payload now projects `manifestCoverage`, `missingDependencies` (kernel-capped at 10) and `missingDependenciesTotal` from the shared kernel receipt, and `opencode2.md`/`agents.md`/`playbooks/opencode.md` document them. Nothing is left of this task's acceptance list except work that already landed, so it is redundant; left `todo` untouched for the coordinator to close as superseded with the reason recorded here. No claim taken, no other file touched.
