---
type: task
status: todo
id: task-ast-grep-structural-rules
title: Adopt ast-grep structural architecture rules
parent: ui-foundation
labels: [tooling, architecture, ci]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
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

- [ ] Add an exact/dev-only `@ast-grep/cli` dependency and committed config/rules; do not add it to `dependencies` or the published runtime surface.
- [ ] Enforce at least two high-value boundaries: tracker mutations outside the shared kernel are rejected, and native tool definitions cannot silently fork outside the shared catalog/seam.
- [ ] Give every rule positive and negative `ast-grep test` coverage and document the rule's architectural rationale, scope, and justified exceptions.
- [ ] Add a deterministic `lint:structure` command and run it in the existing `cli` CI job; never enable unattended `--update-all` rewrites.
- [ ] Keep generated/vendored bundles and fixtures out of false-positive scope while preserving the real architecture boundary.
- [ ] Document local/CI usage in the existing contributor/tooling docs without creating a product dependency or a new architecture fork.
- [ ] `npm test`, `npm run lint`, `npm run lint:structure`, `npm run build`, `npm run check:plugin`, and `arggon validate` are green, with rule-test evidence in the PR.

## Notes

### 2026-09-24 @arggon-reviewer
## Provisional review — PR #418 (read-only; coordinator owns final tracker state)

**Recommendation: NO-MERGE pending fixes.** Green CI is necessary here, but the new guard has reproducible false passes/false failures in the seams it claims to protect.

### P1 — native seam exception is function-wide, not registration-specific
@@tools/ast-grep/rules/native-tools-use-shared-seam.yml:32-83@@ suppresses a match whenever the call is inside any function declaration named @@registerArgonTools@@ that has *any* descendant @@argonToolDefinitions(...)@@ call. It does not prove that the registration uses the returned definitions. I copied the canonical @@opencode/plugins/arggon/index.ts@@ to a temp file, inserted one @@editor.add({ name: "silent-fork", ... })@@ beside the catalog-derived add in @@registerArgonTools@@, and ran @@ast-grep scan --rule ... --threads 1 --report-style short --color never@@; observed exit 0 with no diagnostic. Extra @@ctx.tool.register(...)@@ and a second @@ctx.tool.transform(...)@@ in the same function also pass. The rule's @@editor.add@@ pattern is object-literal-only, so @@editor.add(extraDefinition)@@ outside the seam also evades (temporary probe exit 0).

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

### 2026-09-28 @arggon-reviewer
## Provisional third re-review — PR #418 at `72de1d17f39b7ef4bb436a52d35477146561cc9e`

**Recommendation: NO-MERGE.** The earlier object-literal, TSX, bare-filePath, content-argument, helper, and layout-suppression probes now pass, but the expanded native rule has a new overreach/underreach problem and the tracker remove rule still misses common signatures.

### P0/P1 — PR is not mergeable
GitHub reports `mergeable=CONFLICTING` and `mergeStateStatus=DIRTY` for this head, despite green checks. The branch must be updated/rebased and CI rerun before any merge.

### P1 — native rule makes unrelated production code unmergeable and still has ordinary bypasses
**File:** `tools/ast-grep/rules/native-tools-use-shared-seam.yml:106-116, 118, 148, 197, 222, 224`

The rule now unconditionally matches generic names `register(...)`, `registerTool(...)`, `registerTools(...)`, `addTool(...)`, `install(...)`, and `configure(...)` anywhere in production TS/TSX. It also matches any `editor.add(...)`, `toolEditor.add(...)`, `editor.namespace(...)`, `toolEditor.namespace(...)`, or any `for (const definition of definitions)` outside the exact Arggon flow.

Independent legitimate-module probes were rejected: a router/feature module using `register(router)`, `registerTool(router)`, `addTool(router)`, `install(router)`, `configure(router)`, and a document editor using `editor.add(doc)` / `editor.namespace(...)` / a generic definitions loop. This is a material future-unmergeability regression, not merely a best-effort limitation. The rule needs an Arggon/plugin scope or a stronger contextual predicate, plus valid tests for unrelated modules.

Residual native false passes (full config, exit 0):
- assignment after declaration: `let registrar; registrar = ctx?.tool?.transform; registrar(...)`;
- member alias through a variable: `const api = ctx.tool; api.transform(...)`;
- bracket member alias: `const registrar = ctx["tool"].transform`;
- destructured rename: `const { transform: registrar } = ctx.tool; registrar(...)`;
- destructured tool/member editor aliases: `const { tool } = ctx; tool.transform(...)`, `const { add } = editor; add(extraTool)`, `const add = editor.add`, and `const namespace = editor.namespace`.

The direct declaration aliases and plain `const { transform } = ctx.tool` are caught, but those residual forms are ordinary refactoring shapes. A single canonical loop with `namespace: "fork"` also exits 0, and two exact-looking loops with the second namespace changed to `"fork"` exits 0. The latter is not a byte-for-byte identical duplicate, so the README's sole documented limitation is too narrow; the alternate-namespace test is only outside the canonical flow.

### P1 — tracker remove signatures are still missed; product-path precision is incomplete
**File:** `tools/ast-grep/rules/tracker-mutations-use-kernel.yml:47-63`

Content arguments, generic filePath/outputPath, canonical literal/nested/dynamic item paths, rename sources/destinations, and the new `tracker-rename-destination-use-kernel` rule all passed independent probes. However `WRITER_ONE` only matches one-argument remove calls:

- `rmSync(item.filePath, { recursive: true, force: true })` — no diagnostic;
- `truncateSync(item.filePath, 0)` — no diagnostic;
- `rmdirSync(itemDir)` and `rm(itemPath, { recursive: true })` — no diagnostic.

These are ordinary Node removal signatures and contradict the rule note claiming remove/unlink/truncate path coverage. Add the extra-argument forms (and the intended remove API set) with tests.

There is also a residual product-doc false positive: `writeFileSync(join(root, "docs", "task-beta.md"), ...)` and `join(root, "product", "task-beta.md")` are rejected, while only the documented `ArggonManager/docs` form is excluded. The repo's legacy/product `docs` tree is still a legitimate non-tracker path.

### P2 — acceptance, docs, and PR evidence overstate coverage
The follow-up item `task-ast-grep-structural-rules-review-followup.md:59-67` and the main task notes `task-ast-grep-structural-rules.md:74-82` claim all ordinary identifier/factory/alias/namespace/loop/forged forms and all listed tracker bypasses are covered. The probes above disprove that. The PR body makes the same claim and documents only the identical-duplicate limitation. The exact-duplicate case is an honest structural-indistinguishability note; the alternate-namespace, assignment/member/destructure, generic-name, and remove-signature cases are not.

### Verified
- Current local gates pass: `npm run build && npm run check:plugin && npm test && npm run lint && npm run test:structure && npm run lint:structure && npm run arggon -- validate --json`; 3 structure suites and 95 files/1611 tests.
- CI `cli`, `tasks-validate`, and `ui-smoke` are green.
- TSX is applied: inspect reports canonical `opencode/plugins/arggon/tui.tsx` with 3 rules; synthetic TSX object cases are caught and bare filePath TSX is valid.
- Layout suppression is narrow: the comment lists both tracker rule IDs; an adjacent unsuppressed tracker violation still produced diagnostics. The third rule's scope/ignore list matches the main rule.
- Helper ignores work: `cli/src/test-tmp.ts` and `cli/src/pack-fixtures.ts` receive 0 rules; generated bundle and hidden .opencode output remain excluded.
- Package/CI scope is clean: exact dev-only ast-grep dependency, one-thread scan, no rewrite mode, no rules/config in the tarball, no native plugin source/bundle edits, and no unrelated files.
- No GitHub PR comments or reviews are present; the verdict/history is being kept on the tracker item.

**Provisional outcome: NO-MERGE pending the P0/P1 findings above.**
