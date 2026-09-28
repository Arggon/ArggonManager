---
type: task
status: in_progress
id: task-ast-grep-structural-rules-review-followup
title: Close ast-grep structural rule review gaps
assignee: Arggon
branch: feat/task-ast-grep-structural-rules
parent: ui-foundation
labels: [tooling, architecture, ci]
priority: p1
created: "2026-09-24"
updated: "2026-09-24"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ast-grep-structural-rules-review-followup.md
  Leaves live only under a story. id is the filename stem: task-ast-grep-structural-rules-review-followup.
  CLI `arggon create task ast-grep-structural-rules-review-followup` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Close ast-grep structural rule review gaps

## Context

PR #418 received a provisional **NO-MERGE** coordinator review on 2026-09-24:
https://github.com/Arggon/ArggonManager/pull/418

This follow-up covers the blocking rule-precision findings while implementation
continues in the existing `feat/task-ast-grep-structural-rules` worktree. The
native plugin source and generated bundle remain owned by the separate P1 worker
and must not be edited here.

## Acceptance

- [x] Narrow the native-tool rule to the hand-authored Arggon plugin sources and to the exact `argonToolDefinitions` → catalog definitions → `editor.add` flow, with adversarial tests for identifier/factory adds, alternate namespaces, forged `definitions` bindings, extra loops, second transforms, and direct ctx transforms/adds/registers.
- [x] Cover hand-authored TSX with explicit ast-grep language configuration and positive/negative TSX tests, including `tui.tsx` scan evidence.
- [x] Add valid non-plugin regression cases for `register(router)`, `install(router)`, `configure(router)`, `editor.add(doc)`, `editor.namespace(...)`, and a generic `definitions` loop, enforced by a committed scope fixture that `npm run test:structure` scans.
- [x] Make the tracker rules high-confidence and path-position only: multi-argument `rm`/`rmdir`/`unlink`/`truncate` first-path forms are covered, bare leaf file-name inference is removed so `join(root,"docs","task-beta.md")` and `join(root,"product","task-beta.md")` are valid, and `item.filePath`, tracker/task identifiers, root-qualified `ArggonManager|tasks` paths, `tasksDir` dynamic paths, and rename source/destination are retained.
- [x] Document and scope the structural-root-migration exception for `cli/src/layout-migrate.ts` and reconcile `cli/src/test-tmp.ts` / `cli/src/pack-fixtures.ts` helper scope without opening a production bypass.
- [x] Preserve the exact dev-only dependency, deterministic one-thread scan, existing CI wiring, no-rewrite behavior, and package allowlist.
- [x] Document deliberate/computed/destructured native indirection and the tracker bare-leaf tradeoff as outside structural scope, keeping plugin schema/parity tests authoritative; do not claim those bypasses are covered.
- [x] Record adversarial rule/probe evidence and green focused/full test, lint, build, plugin, validate, diff, and package-surface gates.

## Notes

### 2026-09-24 @ses_f2b15dcecffeuVmXo3s1RGiJBJ

Follow-up implementation evidence (PR #418):

- Native rule now rejects extra `editor.add({...})`, wrong-shaped catalog adds, `ctx.tool.register`, and second transforms even when a function is named `registerArgonTools` and calls `argonToolDefinitions`; the sole allowed flow is the precise definition loop + spread/options payload.
- `sgconfig.yml` maps `.ts`/`.tsx` to the `Tsx` superset; inspect reports `opencode/plugins/arggon/tui.tsx` as `language=Tsx, appliedRuleCount=2`. TSX positive/negative tests are green.
- Tracker rule makes bare `filePath` valid, detects move destinations and nested/literal tracker paths, and keeps the one ADR-0012 layout migration suppression. Helper exclusions are explicit for `cli/src/test-tmp.ts` and `cli/src/pack-fixtures.ts`.
- Temporary adversarial probe returned both rule IDs and no finding for its valid bare-filePath TSX probe. Full gates and package-surface check are green; item remains in_progress for coordinator post-merge completion.

### handoff 2026-09-24 @ses_f2b15dcecffeuVmXo3s1RGiJBJ (session: ses_f2b15dcecffeuVmXo3s1RGiJBJ) — next: Coordinator: review PR #418 against the six checked follow-up criteria and merge; leave follow-up in_progress for post-merge completion.

- branch: feat/task-ast-grep-structural-rules
- open questions: None.

### 2026-09-28 second re-review remediation

The second review's P1s are addressed in the same item/worktree; no new tracker item was created.

- Native rule now uses explicit relational patterns: direct/optional/aliased `ctx.tool` calls, arbitrary alias declarations, identifier/factory `editor.add`, alternate namespaces, direct registration, extra loops, and forged `definitions` bindings with decoy calls are all rejected. The canonical exception requires the direct `definitions = argonToolDefinitions(...)` binding, direct `transform = ctx?.tool?.transform` binding, the `transform` call containing the `definitions` loop, and the exact add payload.
- Tracker mutation matching is position-specific: write/unlink/truncate inspect only the first path argument; a separate rule inspects only the rename destination path. Content arguments (`taskFileContent`, `value.filePath`) and generic `filePath`/`outputPath` are valid; `ArggonManager/docs` is excluded. Canonical literal/nested/dynamic item paths and member/identifier paths are covered.
- Full-config probe: exit 1 with 28 findings across all three rule IDs, all listed native/tracker bypass markers asserted, and no finding on the valid canonical/content markers. Probe removed.
- Final gates: `npm test` (95 files/1611 tests), `npm run lint`, `npm run test:structure` (3 suites), `npm run lint:structure`, `npm run build`, `npm run check:plugin`, native/CLI `validate`, Prettier, `git diff --check`, and package-surface check all green. Native plugin source and bundle remain untouched.
- Remaining exact limitation: a byte-for-byte identical duplicate call inside the already-recognized canonical loop is not distinguishable by ast-grep; ordinary identifier, factory, alias, namespace, loop, and forged-binding forms are covered.

### 2026-09-28 third re-review evidence

- Native rule is now path-scoped to `opencode/plugins/arggon/**/*.ts(x)` (bundle, vendored `.opencode`, and tests ignored) with the unconditional generic-name patterns removed. The scope fixture `tools/ast-grep/tests/non-plugin-valid.tsx` carries `register(router)`, `install(router)`, `configure(router)`, `editor.add(doc)`, `editor.namespace(...)`, and a generic `definitions` loop; `npm run test:structure` scans it and observed 0 findings, which is how non-plugin scope is proven (`ast-grep test` does not evaluate `files`/`ignores`).
- Native positives/negatives: exact canonical `registerArgonTools` flow valid (requires direct `definitions` binding from `argonToolDefinitions`, exact `const transform = ctx?.tool?.transform`, the catalog loop, `...definition`, `options`, `namespace: ARGON_TOOL_NAMESPACE`, `codemode: true`); `namespace: "fork"`, identifier/factory adds, direct and optional ctx transforms/adds/registers, a transform alias outside the flow, an extra loop, a second transform, `tool({...})`, and a wrong-shaped add are all negatives. Deliberate computed/destructured indirection is recorded as out of scope, not as covered.
- Tracker rules are path-position only and high-confidence: `writeFileSync(outputPath, "ArggonManager/story-alpha/task-beta.md")`, `writeFileSync(path, taskFileContent)`, `writeFileSync(join(root,"docs","task-beta.md"))`, `writeFileSync(join(root,"product","task-beta.md"))`, `writeFileSync(join(root,"ArggonManager","docs","story.md"))`, generic `filePath`/`outputPath`, and bare-leaf writes are valid; `item.filePath`, `value.filePath`, `taskPath`/`trackerPath`/`taskFile` identifiers, `join(root,"ArggonManager","initiative","initiative.md")`, nested `…/story/epic/story.md`, `join(tasksDir, id + ".md")` and `join(tasksDir, name)`, rename destinations, and `rmSync(taskPath, { recursive: true, force: true })` / `rmdir(join(tasksDir, name), …)` / `unlink(item.filePath, callback)` / `truncate(taskFile, 0)` are negatives.
- Tooling root cause worth keeping: only the last `$$$ARGS` sibling in one `any` is effective in `@ast-grep/cli@0.45.3`; the rules now contain exactly one each, with the serializer call expressed relationally.
- Probes: legitimate non-plugin probe → 0 findings; in-scope plugin probe → 37 findings across all three rule IDs, 18/18 bypass blocks detected, 0 findings in the valid region; probe files removed.
- Full gates after the merge with `origin/main` (`4517a283`): `npm test` 95 files/1611 tests, `npm run lint`, `npm run test:structure`, `npm run lint:structure`, `npm run build`, `npm run check:plugin`, `arggon validate`, Prettier, `git diff --check`, and package-surface check all green. Exact dev-only `@ast-grep/cli@0.45.3`, one-thread scans, existing CI wiring, and no-rewrite behavior unchanged.

### 2026-09-28 @ses_f2b15dcecffeuVmXo3s1RGiJBJ
**Third re-review remediation — final SHA `ab31d2af`** (branch `feat/task-ast-grep-structural-rules`, PR #418).

**Framing:** all three rules are now documented as **high-confidence structural guards**, not comprehensive semantic enforcement.

**Commands run (expected → observed):**

| Check | Expected | Observed |
|---|---|---|
| `npm run test:structure` | 3 rule suites + scope fixture scan pass | 3/3 PASS, scope scan clean |
| `npm run lint:structure` | clean | exit 0 |
| Full-config probe A (legitimate non-plugin code in `cli/src`) | 0 findings | **0 findings** |
| Full-config probe B (in-scope bypasses in `opencode/plugins/arggon`) | every bypass detected, valid region clean | **37 findings / 18-of-18 bypass blocks detected, 0 findings in valid region** |
| `npm test` | green | 95 files, 1611 tests |
| `npm run lint` | green | exit 0 |
| `npm run build` | green | exit 0 |
| `npm run check:plugin` | bundle byte-identical | exit 0, `git diff --exit-code` clean on `index.bundle.ts` |
| `npm run arggon -- validate --json` | ok | ok, 0 warnings, convention v5 |
| Prettier / `git diff --check` | clean | clean |
| package surface | no `sgconfig.yml`, no `tools/ast-grep/` | 109 files, neither present |

**Native rule** is path-scoped to `opencode/plugins/arggon/**/*.ts(x)` only (bundle, vendored `.opencode`, tests ignored); the unconditional generic-name patterns (`register`, `install`, `configure`, `addTool`, generic loops/editors) are removed. Valid non-plugin regression cases (`register(router)`, `install(router)`, `configure(router)`, `editor.add(doc)`, `editor.namespace(...)`, generic `definitions` loop) live in the committed fixture `tools/ast-grep/tests/non-plugin-valid.tsx`, scanned by `test:structure` — because `ast-grep test` does not evaluate `files`/`ignores`. The exception now additionally requires `namespace: ARGON_TOOL_NAMESPACE` and `codemode: true`; `namespace: "fork"` is an explicit negative.

**Tracker rules** are path-position only; single- and multi-argument `rm`/`rmdir`/`unlink`/`truncate` are inspected at their first path argument. Bare leaf file-name inference removed, so `join(root,"docs","task-beta.md")` and `join(root,"product","task-beta.md")` are valid; `item.filePath`, tracker/task identifiers, root-qualified `ArggonManager|tasks` paths, `tasksDir` dynamic paths, and rename source/destination are retained.

**Root cause found (worth review attention):** in `@ast-grep/cli@0.45.3` only the **last** `$$$ARGS` pattern among siblings in one `any` is effective — the tracker rule had three, so one silently lost coverage. The rules now use exactly one each (unified writer/remover arity; serializer call expressed relationally). Documented under "Authoring notes" in `tools/ast-grep/README.md`.

**Merge:** `origin/main` merged normally as `4517a283`; the only conflict was this item's Notes section, resolved by keeping both sides with no content dropped.

**CI caveat — please confirm before merge:** GitHub has not created a run for `ab31d2af` after ~14 minutes of polling (`gh pr checks 418` reports no checks; the last PR run is for the previous SHA `72de1d17`). No force-push, PR comment, or issue was used to work around it. Locally, every step the `cli` CI job runs was executed green.

Exact dev-only `@ast-grep/cli@0.45.3`, one-thread scans, existing CI wiring, and no-rewrite behavior are unchanged. No native plugin source or bundle path is in the diff.

### handoff 2026-09-28 @ses_f2b15dcecffeuVmXo3s1RGiJBJ (session: ses_f2b15dcecffeuVmXo3s1RGiJBJ) — next: Coordinator: review PR #418 at ab31d2af and merge; confirm CI ran for that SHA (GitHub created no run after ~14 min).
- branch: feat/task-ast-grep-structural-rules
- open questions: CI run for ab31d2af not created by GitHub yet; local ci-job steps all green. Nothing else open.

### 2026-09-28 @ses_f2b15dcecffeuVmXo3s1RGiJBJ
**Final integration for PR #418 — head `0a888c3d`** (no design changes).

**1. Duplicate YAML key fixed.** `tools/ast-grep/rules/tracker-mutations-use-kernel.yml` declared `PATH_ONE` twice under `constraints`. js-yaml confirmed the pre-fix file threw `duplicated mapping key (82:3)`. The removed block was **byte-identical** to the kept one (verified: both the `regex` and the `not.regex` clauses compare equal), so YAML last-wins meant behavior was already the kept definition. Now a pure 5-line deletion, one definition, constraints = `MUTATOR`, `PATH_MULTI`, `PATH_ONE`. Rule tests and scan unchanged: 3/3 suites PASS, `lint:structure` exit 0.

**2. `origin/main` merged normally** as `0a888c3d`. One conflict, in the ast item's Notes. Resolved append-only by concatenating the HEAD block then the main block, so main's P1 completion/cleanup bug history and the third re-review verdict are both preserved. Verified `diff` against **both** sides: no lines dropped from HEAD; the only lines not in main's copy are the intentional `status: in_progress` (vs main's `todo`) and the ticked acceptance boxes. All 26 `###` history sections are present. The P1 completion/cleanup bug items (`bug-native-start-worktree-no-install`, `bug-stale-vendored-plugin-copy`, `task-harden-native-start-rollback-and-pathspec-handling`) came in from main unmodified. No code changes in the resolution.

Note: the merge commit initially failed the pre-commit hook with `@arggondev/lib does not provide an export named 'prepareWorktreeDependencies'`. Cause was a **stale `lib/dist`** predating main's new `lib/src/worktree.ts`, not a code change; `npm run build --workspace @arggondev/lib` cleared it and the commit succeeded.

**3. Gates green at `0a888c3d`:**

| Check | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run check:plugin` | exit 0; rebuilt bundle **matches main's committed bundle** (369567 bytes) — no plugin/bundle edit by us |
| `npm test` | exit 0; 97 files / 1633 tests (up from 95/1611 via main's new lib tests) |
| `npm run lint` | exit 0 |
| `npm run test:structure` | 3/3 suites PASS + non-plugin fixture scan |
| `npm run lint:structure` | exit 0 |
| `arggon validate --json` | ok, 0 warnings, convention v5 |
| Prettier, `git diff --check` | clean |
| package surface | 109 files; no `sgconfig.yml` / `tools/ast-grep/` leak |
| non-plugin fixture | **0 findings** |
| in-scope probe | **18/18 bypasses detected, 0 findings in valid region**; probe files removed |

**4. CI now runs.** After the merge push GitHub created run **CI `36479791296`** and **arggon `36479791279`** for `0a888c3d`. CI **completed/success** (`cli`: success, `ui-smoke`: success); arggon **completed/success**. The earlier no-run condition resolved itself on this push — no comment, issue, or force-push was used. PR #418 is now **MERGEABLE** (`mergeStateStatus` was `BLOCKED` only for the pending check, now satisfied).

**5. State:** both items remain `in_progress`; no GitHub comment or issue (PR still has 0 comments / 0 reviews); no force-push; not merged. Awaiting coordinator review and merge.

### handoff 2026-09-28 @ses_f2b15dcecffeuVmXo3s1RGiJBJ (session: ses_f2b15dcecffeuVmXo3s1RGiJBJ) — next: Coordinator: review PR #418 at 0a888c3d (MERGEABLE, CI 36479791296 green) and merge; both items stay in_progress until post-merge completion.
- branch: feat/task-ast-grep-structural-rules
- open questions: None. Duplicate YAML key fixed, main merged, all gates and CI green.

### 2026-09-28 @ses_f2b15dcecffeuVmXo3s1RGiJBJ
**Final integration complete — head `c60ef7b3`. PR #418 is MERGEABLE with all checks green.**

**1. Duplicate YAML key fixed.** `tools/ast-grep/rules/tracker-mutations-use-kernel.yml` declared `PATH_ONE` twice. js-yaml confirmed the pre-fix file threw `duplicated mapping key (82:3)`. The removed block was **byte-identical** to the kept one (both `regex` and `not.regex` compare equal), so last-wins YAML meant behavior already matched the kept definition. Now a pure 5-line deletion; constraints are `MUTATOR`, `PATH_MULTI`, `PATH_ONE`. Tests/scan unchanged: 3/3 PASS, `lint:structure` exit 0.

**2. `origin/main` merged normally, twice, no code changes in either resolution.**
- First merge: one conflict, the ast item's Notes, resolved **append-only** by concatenating HEAD then main. Verified with `diff` against **both** sides — no lines dropped from HEAD; the only lines absent from main's copy are the intentional `status: in_progress` (main has `todo`) and the ticked acceptance boxes. All history sections preserved, including the P1 completion/cleanup bug records and the third re-review verdict. Committed as `0a888c3d`.
- The merge initially failed the pre-commit hook with `@arggondev/lib does not provide an export named 'prepareWorktreeDependencies'`. Root cause was a **stale `lib/dist`** predating main's new `lib/src/worktree.ts` — not a code change. `npm run build --workspace @arggondev/lib` cleared it; commit then succeeded.
- After posting evidence, `mergeStateStatus` went `BEHIND` because main advanced again (5 tracker-only commits, zero overlap with our files). Merged cleanly with the `ort` strategy as `c60ef7b3` — **no conflict**, only `bug-native-cleanup-unverified-worktree-removal.md` and `bug-opencode-smoke-normalize-bracket-namespace.md`.

**3. All gates green at `c60ef7b3`:**

| Check | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run check:plugin` | exit 0; rebuilt bundle matches main's committed bundle — no plugin/bundle edit by us |
| `npm test` | exit 0; 97 files / 1633 tests |
| `npm run lint` | exit 0 |
| `npm run test:structure` | 3/3 suites PASS + non-plugin fixture scan |
| `npm run lint:structure` | exit 0 |
| `arggon validate --json` | ok, 0 warnings, convention v5 |
| Prettier, `git diff --check` | clean |
| package surface | 109 files; no `sgconfig.yml` / `tools/ast-grep/` leak |
| non-plugin fixture | **0 findings** |
| in-scope probe | **18/18 bypasses detected, 0 findings in valid region**; probe files removed |

PR file scope is unchanged by either merge: rules, tests, fixture, `sgconfig.yml`, `package.json`, CI wiring, `CONTRIBUTING.md`, README, the two items, and the pre-existing ADR-0012 suppression in `cli/src/layout-migrate.ts`.

**4. CI runs confirmed for the final head:** CI **`36481364837` completed/success** (`cli`: success, `ui-smoke`: success) and arggon **`36481364851` completed/success**. Earlier heads: `36479791296` also succeeded. The original no-run condition never recurred. No comment, issue, or force-push was used at any point.

**5. State:** both items `in_progress`, PR has 0 comments / 0 reviews, not merged. Awaiting coordinator review and merge.
