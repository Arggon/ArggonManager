---
type: bug
status: in_progress
id: bug-test-suite-lib-dist-rebuild-race
title: "`npm test` can fail spuriously: five test files rebuild `lib/dist` while vitest runs files in parallel, so a spawned CLI child imports a half-written kernel module"
assignee: arggon-delivery-lead
branch: fix/bug-test-suite-lib-dist-rebuild-race
parent: methodology-improvements
labels: [tests, ci-blocking, tooling]
priority: p1
created: "2026-10-04"
updated: "2026-10-05"
claimed_at: "2026-10-05T20:33:42.754Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-test-suite-lib-dist-rebuild-race
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-test-suite-lib-dist-rebuild-race.md
  Leaves live only under a story. id is the filename stem: bug-test-suite-lib-dist-rebuild-race.
  CLI `arggon create bug test-suite-lib-dist-rebuild-race` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `npm test` can fail spuriously: five test files rebuild `lib/dist` while vitest runs files in parallel, so a spawned CLI child imports a half-written kernel module

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

Found while merging PR #638 (a markdown-only diff), whose `cli` job failed with:

```
SyntaxError: The requested module './relations.js' does not provide an export named 'assertParentEdge'
  at lib/dist/create.js:9
artifactDrift: 'before[lib/dist/create.js=…:504686] after[lib/dist/create.js=…:558367]'
```

**The PR is not the cause** — it touched ADR 0020, `docs/claim.md` and tracker files.
The mechanism, confirmed in this repo at 2026-10-04:

- `lib/src/relations.ts:20` **does** export `assertParentEdge`, and a normal build puts it
  in `lib/dist/relations.js` — so the source and the build are correct in isolation.
- **Five test files trigger a rebuild of `lib/dist` during the run**:
  `cli/src/lib-build.test.ts`, `cli/src/plugin-copy.test.ts`, `cli/src/pack-contents.test.ts`,
  `cli/src/start.test.ts`, `cli/src/test-spawn.test.ts`.
- vitest runs test **files in parallel**, and several of them spawn a child CLI that imports
  the built kernel. When a rebuild lands between two writes, a child can observe a
  `lib/dist` whose module graph is momentarily inconsistent — exactly the failure above.
- The harness already reports `artifactDrift` when build outputs change mid-test, so the
  signal exists; it is not yet treated as a failure cause.

**Why this is p1 despite being a test-only bug:** a red `cli` lane that is not caused by the
change under test trains people to re-run instead of read, and every future reviewer has to
spend the diagnosis again. It has now cost two sessions.

## Acceptance

- [ ] Reproduced deterministically: a test that runs the build concurrently with a child-CLI
      suite fails on the stale-export shape (the harness's `artifactDrift` is the handle)
- [ ] Fixed by **isolation, not by retry**: the suites that need a build build into their own
      temp root (or the child processes read a build the suite owns), so no test mutates the
      shared `lib/dist` another test is reading
- [ ] `cli/src/{lib-build,plugin-copy,pack-contents,start,test-spawn}.test.ts` reviewed for the same pattern, and every occurrence fixed rather than the first
- [ ] The harness's existing `artifactDrift` diagnostic is promoted to a **named failure** when it fires during a suite, so this class reports itself instead of surfacing as an unrelated SyntaxError
- [ ] `npm test` run **repeatedly** (≥5 consecutive full runs) green — a race fix that is not
      demonstrated to hold across runs is not a fix
- [ ] `arggon validate` ok; no snapshot or gate weakened to make the suite pass
- [ ] If the correct fix is structural (one build, many suites — e.g. a globalSetup that builds
      once and forbids per-suite rebuilds), prefer that over five local patches
