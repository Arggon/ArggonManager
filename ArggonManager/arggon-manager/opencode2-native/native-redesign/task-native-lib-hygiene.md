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

- [x] `commander` is either declared for types or removed from the public
      `.d.ts` surface; consumer type-check passes without undeclared imports.
      (Removed: `JsonProgram` is structural; the consumer type-check is pinned
      in `cli/src/lib-build.test.ts` and mutation-verified.)
- [x] Worktree resolution: tests/CLI work in a linked worktree without
      resolving `@arggon/lib` to the primary (or the requirement is documented
      and enforced in `start`).
      (Documented in `CONTRIBUTING.md`/`lib/README.md`/`README.md` and reported
      by `start --worktree` as `linkedWorkspaces` + stdout note; the full
      resolution fix needs the worktree built before the claim commit's gate —
      see the PR notes.)
- [x] `rules.ts` identity test asserts something non-tautological.
      (Moved to `lib/src/index.test.ts`; the in-place static deep import is not
      possible — it breaks `npm run build` with TS6059.)
- [x] Docs drift fixed (`CONTRIBUTING`/README about `lib/`).
- [x] `lib/dist` excludes `*.test.*` (or the pack exclusion is documented).
      (Emit pass excludes them; `tsconfig.typecheck.json` keeps them
      type-checked; asserted in `cli/src/lib-build.test.ts`.)
- [x] `lib/src/import-issues.ts` forwards `cwd` to `ghIssueListJson` (native
      calls currently resolve the repo from the server process cwd; `sync`
      already does it right).
- [ ] `arggon validate` green; CI green.
      (`arggon validate` ok locally, convention v5 — CI runs on PR #384.)

## Notes

- PO decisions still open: publishing/versioning of `@arggon/lib` (private
  until W6/W7) and the W2/W3 `templatesDir` injection requirement.

### 2026-09-21 @Arggon
Worker evidence for PR #384 (branch `feat/task-native-lib-hygiene`, 5 commits: ae158d3, f99ae70, a65d4ad, eb6073d, 9f2c058).

Environment note: this worktree was started with `--worktree` (linked `node_modules` → primary) and then given a **local `npm ci`** install, because finding 2's linked shape would make every spawned CLI test run the _primary's_ `lib/dist` instead of this branch's kernel. That local install is itself the documented remediation.

## Gates (all run in the worktree, after the final content commit)

- `npm run build` ✅ (kernel emit + kernel test typecheck + root tsc + `build:plugin` regenerated)
- `npm test` ✅ **1462 passed / 90 files** (before: same counts; +5 tests net: consumer type-check, dist-no-tests pin, entry identity, 3 `linkedWorkspacePackages` unit cases, `import-issues` cwd cases, `start --worktree` fixture, CLI envelope assertions)
- `npm run lint` ✅ exit 0 · `npx prettier --check` on every touched file ✅
- `npm run check:plugin` ✅ exit 0 (bundle regenerated and committed)
- `npm run arggon -- validate` ✅ ok, convention v5 · `npm run arggon -- spec validate` ✅ 18 docs
- CI on PR #384: pending at the time of writing (the item's last box stays unchecked until it is green).

## Finding 1 — commander types (before/after)

Consumer fixture: real copy of `lib/dist` (+`@types/node`, **no commander**) under `node_modules/@arggon/lib`, `tsc --noEmit --strict --module nodenext consumer.ts`.

- before (primary's build): `node_modules/@arggon/lib/dist/json.d.ts(1,30): error TS2307: Cannot find module 'commander' or its corresponding type declarations.`
- after: exit 0.
  Mutation sanity: re-adding the commander type to `lib/src/json.ts` makes the new test fail with that exact TS2307. `dist/*.d.ts` now import only `node:*` and relative modules.

## Finding 2 — worktree resolution (smoke, real `dist/cli.js` on a fixture repo)

- workspace link (`node_modules/@arggon/lib -> ../../lib`) + committed `lib/`: `linkedNodeModules=true linkedWorkspaces=["@arggon/lib"]`
- plain install (no workspace link): `linkedNodeModules=true linkedWorkspaces=[]`
- human output: `note: @arggon/lib resolve(s) into the primary checkout through the linked install — build there, or run \`npm ci\` in the worktree (e.g. \`x-worktree.post-start: npm ci\`) for worktree-local resolution`
- `arggon validate`/`npm test`-requires-a-build is now documented in CONTRIBUTING (CI already builds before testing).
  Decision (deviation from the item's first option, reported for review): the resolution itself was NOT changed. A link farm pointing `@arggon/lib` at the worktree copy needs `<worktree>/lib/dist` **before** the claim commit's pre-commit gate, so `start` would have to build the kernel (kernel layering) or the gate would fail — regressing `bug-start-worktree-node-modules`. The item explicitly allows "documented and enforced in `start`", which is what landed (`linkedWorkspaces` + stdout note + docs). If the coordinator wants the real resolution flip, it needs its own item (build-before-gate design).

## Finding 3 — identity test

`lib/src/index.test.ts` compares the entry bindings against `rules.ts`/`status.ts`/`relations.ts`/`next.ts` (`toBe`, not a wrapper). The reviewer's literal fix (static `../../lib/src/rules.js` in the cli test) was verified to break `npm run build`: `cli/src/lib.test.ts(1,30): error TS6059: File '.../lib/src/rules.ts' is not under 'rootDir' '.../cli/src'` (+ stray emit) — hence the relocation and the note in `lib/src/index.test.ts`.

## Finding 5 — dist test artifacts

`ls lib/dist | grep '\.test\.'` → 0 (was 26 artifacts in the primary's build). The typecheck pass still includes 13 test files (`tsc -p lib/tsconfig.typecheck.json --listFiles`), and a mutation (`const x: number = "s"` in a lib test) fails the build.

## Finding 6 — `import-issues` cwd (smoke)

Fake `gh` logging `$PWD`, probe run from `/tmp/opencode` (the "server" cwd) with the tracker at `/tmp/opencode/libhygiene-smoke/fixture`:

- before (pre-fix build): `gh ran in /tmp/opencode`
- after: `gh ran in /tmp/opencode/libhygiene-smoke/fixture`
  Tests pin both the helper's forwarding and that the operation passes its own `cwd` (and that no `cwd` key is added when the caller omits it).

## Out of scope / not done

- ADR index rows 0005–0009: flagged as pre-existing in the item context, outside its acceptance — untouched.
- `ArggonManager/docs/agents.md` (generated, drift-gated against `templates/`) does not mention `linkedWorkspaces`; the adopter template was not changed.
- PO decisions in Notes (publishing/versioning of `@arggon/lib`, W2/W3 `templatesDir` injection) untouched.
