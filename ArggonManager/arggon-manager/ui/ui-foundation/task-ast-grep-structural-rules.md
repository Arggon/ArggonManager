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
- [x] Enforce at least two high-value boundaries: tracker mutations outside the shared kernel are rejected, and native tool definitions cannot silently fork outside the shared catalog/seam.
- [x] Give every rule positive and negative `ast-grep test` coverage and document the rule's architectural rationale, scope, and justified exceptions.
- [x] Add a deterministic `lint:structure` command and run it in the existing `cli` CI job; never enable unattended `--update-all` rewrites.
- [x] Keep generated/vendored bundles and fixtures out of false-positive scope while preserving the real architecture boundary.
- [x] Document local/CI usage in the existing contributor/tooling docs without creating a product dependency or a new architecture fork.
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
