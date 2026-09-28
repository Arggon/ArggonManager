---
type: task
status: in_progress
id: task-ast-grep-structural-rules
title: Adopt ast-grep structural architecture rules
assignee: Arggon
branch: feat/task-ast-grep-structural-rules
parent: ui-foundation
labels: [tooling, architecture, ci]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
claimed_at: "2026-09-24T15:36:11.442Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-ast-grep-structural-rules
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ast-grep-structural-rules.md
  Leaves live only under a story. id is the filename stem: task-ast-grep-structural-rules.
  CLI `arggon create task ast-grep-structural-rules` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopt ast-grep structural architecture rules

## Context

Adopt the dev-only `ast-grep` CLI as a low-context structural guard. Keep ESLint/TypeScript responsible for type-aware policy; ast-grep should enforce a small set of repository architecture boundaries that ordinary text lint cannot express. Do not add an MCP server or a codemod that rewrites source automatically.

## Acceptance

- [x] Add an exact/dev-only `@ast-grep/cli` dependency and committed config/rules; do not add it to `dependencies` or the published runtime surface.
- [x] Enforce at least two high-value boundaries as a high-confidence structural guard: tracker mutations outside the shared kernel are rejected, and native tool definitions cannot silently fork outside the shared catalog/seam.
- [x] Give every rule positive and negative `ast-grep test` coverage and document the rule's architectural rationale, scope, and justified exceptions.
- [x] Add a deterministic `lint:structure` command and run it in the existing `cli` CI job; never enable unattended `--update-all` rewrites.
- [x] Keep generated/vendored bundles and fixtures out of false-positive scope while preserving the real architecture boundary.
- [x] Document local/CI usage in the existing contributor/tooling docs without creating a product dependency or a new architecture fork.
- [x] State in the rule notes, README, CONTRIBUTING, and PR body that these are high-confidence structural guards and list the exact structural limitations (a bare leaf file name is not a tracker signal; deliberate/computed/destructured native indirection is out of scope; a tracker path assembled from unrelated fragments is not inferred). Do not claim comprehensive semantic enforcement.
- [x] `npm test`, `npm run lint`, `npm run lint:structure`, `npm run build`, `npm run check:plugin`, and `arggon validate` are green, with rule-test evidence in the PR.

## Notes

### 2026-09-24 @ses_f2b15dcecffeuVmXo3s1RGiJBJ

Implementation evidence for PR #418 (expected → observed):

- Exact dev-only dependency: expected @ast-grep/cli@0.45.3 outside runtime deps/pack allowlist → observed devDependencies-only; npm pack --dry-run lists neither sgconfig.yml nor tools/ast-grep/.
- Rule tests: expected both suites pass → observed `npm run test:structure` PASS for tracker-mutations-use-kernel and native-tools-use-shared-seam.
- Production red probe: expected both boundaries reject a temporary cli/src file → observed exit 1 with tracker + native diagnostics; probe removed.
- Scope probe: expected canonical source covered while generated bundle and fixture harnesses are excluded → observed --inspect entity applied 2 rules to opencode/plugins/arggon/index.ts and 0 to index.bundle.ts/e2e/smoke harnesses.
- Full gates green: npm ci; build; check:plugin; test (95 files/1611 tests); lint; structure tests/scan; native validate (0 warnings); git diff --check.

No product-scope finding or new tracker work was revealed. Local npm blocked dependency postinstall scripts by machine policy, but @ast-grep/cli runtime binary resolution worked and all commands completed; CI is queued on PR #418.

### handoff 2026-09-24 @ses_f2b15dcecffeuVmXo3s1RGiJBJ (session: ses_f2b15dcecffeuVmXo3s1RGiJBJ) — next: Coordinator: review and merge PR #418 after queued checks pass; keep this item in_progress until merge.

- branch: feat/task-ast-grep-structural-rules
- open questions: None.

### 2026-09-24 @ses_f2b15dcecffeuVmXo3s1RGiJBJ

Review follow-up evidence for PR #418 (all blocking findings addressed):

- Native seam: narrowed the sole exception to the exact `editor.add({ ...definition, options: { namespace, codemode } })` inside the `for (const definition of definitions)` flow in a `registerArgonTools` function that calls `argonToolDefinitions`; direct ctx transforms/registers remain errors. Added adversarial cases for extra adds, wrong shape, alternate registration, and second transform. No native plugin source or bundle edit.
- TSX: verified ast-grep's separate TypeScript/TSX parsers and configured the `Tsx` superset via `languageGlobs`; `tui.tsx` is scanned as `Tsx` with both rules, and TSX valid/invalid cases pass.
- Tracker: removed bare `filePath` matching; added source/destination, member, literal, nested `join`/`resolve`, and canonical tracker-item cases. `writeFileSync(filePath, ...)` is valid. `layout-migrate.ts` has one documented ADR-0012 inline root-migration suppression; `test-tmp.ts` and `pack-fixtures.ts` are explicit test-only exclusions.
- Adversarial probe: temporary production TSX probe returned exit 1 with both rule IDs, while its bare-filePath valid probe returned no finding; probe files removed.
- Gates after fixes: `npm test` (95 files/1611 tests), `npm run lint`, `npm run test:structure`, `npm run lint:structure`, `npm run build`, `npm run check:plugin`, native/CLI `validate`, Prettier, `git diff --check`, and package-surface check all green. Dependency remains exact dev-only @ast-grep/cli@0.45.3; no rewrite mode.

### handoff 2026-09-24 @ses_f2b15dcecffeuVmXo3s1RGiJBJ (session: ses_f2b15dcecffeuVmXo3s1RGiJBJ) — next: Coordinator: review the narrowed rules and green evidence on PR #418, then merge; keep original in_progress until post-merge completion.

- branch: feat/task-ast-grep-structural-rules
- open questions: None.

### 2026-09-28 second re-review remediation

Follow-up item: `task-ast-grep-structural-rules-review-followup` (same branch/worktree, `in_progress`).

- Native rule now rejects identifier/factory adds, extra/second definition loops, alternate namespaces, direct/aliased transforms, direct registration, and forged `definitions` bindings with a decoy `argonToolDefinitions` call. The only exception requires the direct `definitions` and `transform` bindings plus the exact catalog loop/payload. The remaining documented limitation is a byte-for-byte identical duplicate inside that exact loop.
- Tracker rules inspect only path arguments: content arguments such as `taskFileContent` and `value.filePath` are ignored, generic `filePath`/`outputPath` are valid, and `ArggonManager/docs` paths are excluded. Source and rename-destination paths, canonical `initiative.md`/`epic.md`/`story.md`, nested tracker paths, and `join(tasksDir, id + ".md")` are covered.
- The full-config adversarial probe returned exit 1 with 28 findings across the three rule IDs, asserted every listed native/tracker bypass, and produced no finding for the valid content/canonical flow markers. Probe files were removed.
- Final green evidence: `npm test` (95 files/1611 tests), `npm run lint`, `npm run test:structure` (3 suites), `npm run lint:structure`, `npm run build`, `npm run check:plugin`, native/CLI `validate`, Prettier, `git diff --check`, and package-surface check. No native plugin source or bundle path is in the PR diff.
- Exact dev-only `@ast-grep/cli@0.45.3`, one-thread scan, CI wiring, and no-rewrite behavior remain unchanged.

### 2026-09-24 @arggon-reviewer

## Provisional review — PR #418 (read-only; coordinator owns final tracker state)

**Recommendation: NO-MERGE pending fixes.** Green CI is necessary here, but the new guard has reproducible false passes/false failures in the seams it claims to protect.

### P1 — native seam exception is function-wide, not registration-specific

@@tools/ast-grep/rules/native-tools-use-shared-seam.yml:32-83@@ suppresses a match whenever the call is inside any function declaration named @@registerArgonTools@@ that has _any_ descendant @@argonToolDefinitions(...)@@ call. It does not prove that the registration uses the returned definitions. I copied the canonical @@opencode/plugins/arggon/index.ts@@ to a temp file, inserted one @@editor.add({ name: "silent-fork", ... })@@ beside the catalog-derived add in @@registerArgonTools@@, and ran @@ast-grep scan --rule ... --threads 1 --report-style short --color never@@; observed exit 0 with no diagnostic. Extra @@ctx.tool.register(...)@@ and a second @@ctx.tool.transform(...)@@ in the same function also pass. The rule's @@editor.add@@ pattern is object-literal-only, so @@editor.add(extraDefinition)@@ outside the seam also evades (temporary probe exit 0).

The tests do not cover this boundary: @@tools/ast-grep/tests/native-tools-use-shared-seam-test.yml:14-18@@ uses @@editor.add(definition)@@, which the rule never matches; the only same-name negative at @@:22-24@@ omits @@argonToolDefinitions@@. Add the real object-literal catalog registration as a positive and catalog-plus-extra registration as a negative, then narrow the exception to the actual catalog-to-editor flow (or an equivalent narrowly constrained shape).

### P1 — the declared TSX scope is silently skipped

Both rules set @@language: TypeScript@@ (tracker rule @@tools/ast-grep/rules/tracker-mutations-use-kernel.yml:2@@; native rule @@.../native-tools-use-shared-seam.yml:2@@) while listing @@**/*.tsx@@ at @@:14-16@@. On the hand-authored, shipped canonical TUI source @@opencode/plugins/arggon/tui.tsx:1-25@@, @@ast-grep scan --inspect entity@@ reports @@language=Tsx,appliedRuleCount=0@@. A temporary TSX file containing both @@editor.add({ ... })@@ and @@writeFileSync(item.filePath, ...)@@ exited 0 under each rule. This is a production-source blind spot, not a justified generated-file exclusion. Add TSX-capable rule coverage/tests; do not hide the canonical TUI by excluding it.

### P1 — tracker rule is both over- and under-inclusive

@@tools/ast-grep/rules/tracker-mutations-use-kernel.yml:42-50@@ applies its path regex to the first writer argument. The regex's final @@|filePath@@ alternative (@@:50@@) rejects a legitimate product writer such as @@writeFileSync(filePath, body)@@; the test at @@tools/ast-grep/tests/tracker-mutations-use-kernel-test.yml:41@@ enshrines that false positive even though the rule note/README say non-item product docs are allowed (@@tools/ast-grep/README.md:14-16@@). The required @@item.filePath@@, @@taskPath@@, @@trackerPath@@, and @@tasksDir@@ cases did diagnose in independent probes, but the generic case did too.

Conversely, the writer patterns never constrain the second argument of a move. The real production @@renameSync(trackerMove.from, trackerMove.to)@@ at @@cli/src/layout-migrate.ts:131@@ is scanned but produces no diagnostic; synthetic @@renameSync(sourceAsset, taskPath)@@ and @@renameSync(sourceAsset, item.filePath)@@ also exit 0. If layout migration is intentionally outside the kernel, it needs a narrow documented exception; otherwise the rule must catch the move. Add a valid generic-@@filePath@@ product-write case, destination/move negatives, and reconcile the “sole production exception is lib/src” claim.

### P2 — test-helper scope is broader than the documentation

@@cli/src/test-tmp.ts:1-4@@ and @@cli/src/pack-fixtures.ts:1-12@@ identify themselves as test-only helpers, but @@--inspect entity@@ shows both receiving 2 rules; the ignore list only covers test/spec suffixes and broad harness directories. This is not a production bypass today, but it can create fixture false positives and makes the README's “unit/smoke harnesses ... excluded” claim imprecise. Either explicitly scope those helpers out or document why they are scanned.

### Verified / gate assessment

- Full local @@npm run build && npm run check:plugin && npm test@@: 95 files / 1611 tests passed; @@npm run lint@@, @@npm run test:structure@@ (2 suites), @@npm run lint:structure@@, @@git diff --check@@, and @@npm run arggon -- validate --json@@ all passed.
- PR CI is green: @@cli@@ (including both new structure commands), @@tasks-validate@@, and @@ui-smoke@@.
- @@@ast-grep/cli@0.45.3@@ is exact and devDependencies-only; @@npm pack --dry-run@@/existing pack contract showed no @@sgconfig.yml@@ or @@tools/ast-grep/@@ in the published surface; no runtime dependency or MCP/codemod/rewrite mode was added. @@lint:structure@@ uses @@--threads 1@@ and CI contains no update/rewrite flag.
- No product CLI/UI source changed, so the engineering CLI/browser smoke gate is not applicable; the existing UI CI smoke is green. I did not run a review-time real-browser drive.
- The explicit generated/test ignores (bundle, hidden @@.opencode@@, fixtures, e2e/smoke/test/labs) are otherwise justified, and the canonical @@.ts@@ plugin source is scanned. New ast-grep files and package-lock are not in the supplied graph generation, so I read those directly.

**Final review outcome for coordinator: NO-MERGE until the P1 rule/coverage gaps above are fixed and re-reviewed.

### 2026-09-24 @arggon-reviewer

## Provisional verdict correction — PR #418

The previous provisional comment's ` markers are formatting artifacts; the findings and NO-MERGE recommendation stand.

**P1 blockers:**

- `tools/ast-grep/rules/native-tools-use-shared-seam.yml:32-83`: the exception is function-wide. A temp copy of the canonical `opencode/plugins/arggon/index.ts` with an extra `editor.add({ name: "silent-fork", ... })` inside `registerArgonTools` (which also calls `argonToolDefinitions`) scanned clean (exit 0). Extra `ctx.tool.register` / second transform also pass. The valid test at `tools/ast-grep/tests/native-tools-use-shared-seam-test.yml:14-18` uses `editor.add(definition)`, a form the rule never matches, and the same-name negative at `:22-24` omits the catalog call. Add real object-literal and catalog-plus-extra cases and narrow the exception.
- Both rule files set `language: TypeScript` (`tools/ast-grep/rules/tracker-mutations-use-kernel.yml:2`, `.../native-tools-use-shared-seam.yml:2`) but list `**/*.tsx` (`:14-16`). `ast-grep --inspect entity` reports `language=Tsx,appliedRuleCount=0` for the hand-authored shipped `opencode/plugins/arggon/tui.tsx`; a temporary TSX file containing both forbidden forms scanned clean. Add TSX-capable coverage.
- `tools/ast-grep/rules/tracker-mutations-use-kernel.yml:42-50` rejects generic `writeFileSync(filePath, ...)` via the `|filePath` alternative, despite the documented non-tracker product-doc exception; the test at `tools/ast-grep/tests/tracker-mutations-use-kernel-test.yml:41` enshrines it. The same patterns only constrain a writer's first argument, so real `cli/src/layout-migrate.ts:131` `renameSync(trackerMove.from, trackerMove.to)` and synthetic `renameSync(sourceAsset, taskPath)` scan clean. Add a valid generic-filePath case, destination/move negatives, and either a narrow documented layout-migration exception or enforcement.

**P2:** `cli/src/test-tmp.ts:1-4` and `cli/src/pack-fixtures.ts:1-12` are test-only but are still scanned (`--inspect entity` gives each 2 rules), contrary to the README's broad harness-exclusion wording.

**Verified:** local build/check:plugin, 95-file/1611-test suite, lint, both structure commands, validate, and diff check passed; PR CI `cli`, `tasks-validate`, and `ui-smoke` are green. Dependency is exact/dev-only, package surface excludes the rules/config, scan is `--threads 1`, and no rewrite/update flag exists. No product CLI/UI source changed, so browser/CLI smoke is not applicable; no review-time browser drive was run.

**Recommendation: NO-MERGE pending the P1 fixes and re-review.

### 2026-09-24 @arggon-reviewer

## Provisional review addendum — tracker path coverage

One more concrete P1 false negative belongs with the tracker finding: the regex in `tools/ast-grep/rules/tracker-mutations-use-kernel.yml:50` recognizes variable names such as `taskPath`, but not literal canonical item paths. A temp production-shaped `writeFileSync(join(root, "ArggonManager", "story", "story.md"), ...)` and the deeper `.../"launch"/"epic"/"story"/"task.md"` form both scanned with exit 0. Those are direct writes to canonical tracker items, so the current green scan is a false pass. Add literal-layout negatives while keeping `ArggonManager/docs` product writes allowed; the positive/negative boundary needs to be structural, not a broad ArggonManager substring.

This reinforces the existing NO-MERGE recommendation; no project files were changed.

### 2026-09-24 @arggon-reviewer

## Provisional re-review — PR #418 at `abfbb3e313ddf0113d0da667a55032ec75d5dc78`

**Recommendation: NO-MERGE pending the remaining P1 rule-precision fixes.** The remediation correctly fixes the earlier object-literal exception, TSX parser scope, bare-`filePath` false positive, helper ignores, and narrow layout-migration suppression. It does not yet make the claimed native/tracker boundaries materially true.

### P1 — native rule still misses ordinary identifier/expression registrations and forged catalog data

**File:** `tools/ast-grep/rules/native-tools-use-shared-seam.yml:36-102`

The new rule only matches `editor.add({ ... })`. Independent full-config probes produced **exit 0 / no diagnostic** for:

- `editor.add(extraTool)` and `editor.add(makeDefinition())` in TS and TSX;
- a second definition loop whose add is `editor.add(extra)`;
- a second exact-looking definition loop with an alternate namespace;
- `const transform = ctx?.tool?.transform` followed by two aliased transform calls, including `editor.add(extraTool)`;
- a correctly named `registerArgonTools` function whose `definitions` is a forged array while a decoy `argonToolDefinitions(...)` call is present and the exact-looking payload uses `namespace: "fork"`.

I also copied the real canonical `opencode/plugins/arggon/index.ts`, replaced its catalog binding with a forged array, retained a call to `argonToolDefinitions`, and the rule still exited 0. The API type at `opencode/plugins/arggon/index.ts:134-137` accepts a variable definition, so identifier/factory registration is an ordinary type-valid production shape, not an exotic best-effort limitation. The new tests (`tools/ast-grep/tests/native-tools-use-shared-seam-test.yml:14-70`) cover the corrected object-literal flow and direct calls, but none of these identifier/alias/forged-result cases. A single direct `ctx.tool.transform` with the exact catalog flow is rejected, while multiple aliased transforms are not: the rule is asymmetric as well as incomplete.

### P1 — tracker rule still has material false positives and false negatives

**File:** `tools/ast-grep/rules/tracker-mutations-use-kernel.yml:46-88`

False positives from ordinary non-tracker writes:

- `writeFileSync(outputPath, "ArggonManager/story-alpha/task-beta.md")` (a content string, not a path);
- `writeFileSync(outputPath, taskFileContent)` and `writeFileSync(outputPath, value.filePath)`;
- `writeFileSync(join(root, "ArggonManager", "docs", "task-beta.md"), ...)` and the literal product-doc form `"ArggonManager/docs/task-beta.md"`.

False negatives for ordinary canonical tracker paths:

- `writeFileSync(join(root, "ArggonManager", "story", "story.md"), ...)`, plus initiative/epic index files;
- dynamic forms such as a template-generated id under an `ArggonManager/story-alpha` directory, and the former ordinary form using `join(tasksDir, id + ".md")`.

The rule's `inside: $WRITER(...)` checks all arguments/strings rather than path positions, and its literal regex requires a hyphenated leaf id, so it both flags content/product-doc data and misses canonical index/dynamic paths. The added source/destination, nested, and hyphenated-leaf positives do not close these cases.

### P2 — acceptance/docs/PR evidence overstate the current result

The follow-up item `ArggonManager/arggon-manager/ui/ui-foundation/task-ast-grep-structural-rules-review-followup.md:35-49` and the main task notes (`.../task-ast-grep-structural-rules.md:31-64`) check off the native and tracker boundaries as complete, but the probes above disprove those claims. The PR body is also still the pre-remediation summary and does not identify the follow-up item or the remaining identifier/dynamic-path limitations. The follow-up item is otherwise correctly placed under the story with a sensible P1 checklist; its native-plugin-source/bundle scope restriction is respected.

### Verified

- Full local `npm run build && npm run check:plugin && npm test && npm run lint && npm run test:structure && npm run lint:structure && npm run arggon -- validate --json` passed; npm test remains 95 files / 1611 tests.
- CI is green: `cli`, `tasks-validate`, and `ui-smoke`.
- `sgconfig.yml:9-14` now applies the Tsx parser to both .ts/.tsx; inspect reports canonical `opencode/plugins/arggon/tui.tsx` with 2 applied rules. Synthetic TSX object-literal/native and tracker cases are caught; bare `filePath` TSX is valid.
- The `ast-grep-ignore: tracker-mutations-use-kernel` suppression at `cli/src/layout-migrate.ts:132-134` is narrow and ADR-0012-backed; an adjacent unsuppressed tracker violation still produced an error.
- `cli/src/test-tmp.ts` and `cli/src/pack-fixtures.ts` now receive 0 rules; generated bundle and hidden .opencode output remain excluded. Package surface remains dev-only, exact-pinned, one-thread, no-rewrite, and excludes sgconfig/rules from the tarball.
- No GitHub PR comments or reviews are present; the review history/verdict is being kept on the tracker item as required.

**Final provisional outcome: NO-MERGE.**

### 2026-09-28 third re-review remediation

Follow-up item: `task-ast-grep-structural-rules-review-followup` (same branch/worktree, `in_progress`).

These rules are now framed as **high-confidence structural guards**, not comprehensive semantic enforcement.

- Native rule narrowed to the hand-authored plugin sources only (`opencode/plugins/arggon/**/*.ts(x)`, ignoring the generated bundle, vendored `.opencode`, and tests). The unconditional generic-name patterns (`register`, `registerTool(s)`, `addTool`, `install`, `configure`, generic loops/editors outside the plugin) are gone, so unrelated modules may keep their own vocabulary. The committed fixture `tools/ast-grep/tests/non-plugin-valid.tsx` holds `register(router)`, `install(router)`, `configure(router)`, `editor.add(doc)`, `editor.namespace(...)`, and a generic `definitions` loop; `npm run test:structure` now scans it and observed 0 findings.
- In-plugin enforcement: direct and optional `ctx.tool` transforms/adds/registers, the exact `const transform = ctx?.tool?.transform` alias, `tool({...})`/`tool` imports, and `editor.add`/`editor.namespace`/definition loops outside the exact canonical catalog flow. The exception additionally requires `namespace: ARGON_TOOL_NAMESPACE` and `codemode: true` values; `namespace: "fork"` is an explicit negative.
- Tracker rules are path-position only. Writer and remover families are unified so single- and multi-argument `rm`/`rmdir`/`unlink`/`truncate` are inspected at their first path argument. Bare leaf file-name inference was removed, so `join(root,"docs","task-beta.md")` and `join(root,"product","task-beta.md")` are valid; retained signals are `item.filePath`, tracker/task identifiers, root-qualified `ArggonManager|tasks` item paths, `tasksDir` dynamic paths, and rename source/destination.
- Root cause of the lingering false negatives: in `@ast-grep/cli@0.45.3` only the **last** `$$$ARGS` pattern among siblings in one `any` is effective, and the tracker rule had three. The rules now use exactly one, expressing the serializer call relationally and unifying writer/remover arities. Documented in the README authoring notes.
- Probe A (legitimate non-plugin code under `cli/src`) → 0 findings. Probe B (in-scope plugin probe) → 37 findings across all three rule IDs; 18/18 bypass blocks detected (identifier add, factory add, fork namespace, direct and optional ctx transform, ctx add, ctx register, transform alias, forged `definitions` with decoy catalog call, extra loop, second transform, `tool({...})`, wrong payload, `item.filePath` write, `tasksDir` write, `rmSync`, rename destination, `stringifyFrontmatter`) and 0 findings in the valid region (canonical `registerArgonTools` flow plus product-doc and content-argument writes). Probe files were removed.
- Gates green: `npm test` (95 files/1611 tests), `npm run lint`, `npm run test:structure` (3 suites + scope scan), `npm run lint:structure`, `npm run build`, `npm run check:plugin` (bundle byte-identical), `arggon validate`, Prettier, `git diff --check`, and package surface (109 files; no `sgconfig.yml` or `tools/ast-grep/`). No native plugin source or bundle path is in the diff.
- `origin/main` was merged normally (merge commit `4517a283`). The only conflict was this item's Notes section, resolved by keeping both sides; no main-side content was dropped.

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
