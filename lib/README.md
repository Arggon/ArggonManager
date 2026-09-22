# @arggondev/lib — ArggonManager kernel

The kernel of ArggonManager as its own package ([ADR 0013](../ArggonManager/docs/adr/0013-lib-package-split.md),
amending [ADR 0011 §5](../ArggonManager/docs/adr/0011-native-first-architecture.md)):
**one logic path, one library**. The root package (`arggon-manager`) ships the
CLI/headless bin and the vendored plugin and depends on this package through
the npm workspace (`"workspaces": ["lib"]`).

- **Entry:** `lib/src/index.ts` → `dist/index.js` + `dist/index.d.ts`, exposed
  through the package `exports` map (ESM only).
- **Build:** `npm run build` at the repo root builds this package first
  (`npm run build --workspace @arggondev/lib`), then the root `tsc`. The kernel
  build runs two `tsc` passes: the emit pass (`tsconfig.json`) excludes
  `src/**/*.test.ts`, so `dist/` ships no test artifacts, and a `--noEmit`
  pass (`tsconfig.typecheck.json`) still type-checks the test files.
- **Dependencies:** none at runtime (Node builtins only). No commander, no
  printing, no argv parsing, no bundled assets — the CLI entrypoint and the
  seam generation live in the root package. The public `.d.ts` is held to the
  same rule: nothing it imports may be undeclared, so a consumer type-check
  never fails on a missing package (the entry's program view is a structural
  `JsonProgram`, not commander's `Command`; gate: the consumer type-check in
  `cli/src/lib-build.test.ts`).
- **Assets:** item creation reads the repo's own `templates/<type>.md` first and
  otherwise the `templatesDir` the root adapter injects
  (`create`/`import-issues` options). The library itself ships no templates.

## Stable export subset

The machine surfaces (CLI, MCP adapter, and the native plugin tools of
W2/W3/W4) rely on this subset — it is the contract:

| Area           | Exports                                                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **items**      | `loadItems`, `itemsById`, `tryLoadItem`, `softTryLoadItem`, `walkTasksTree`, `acceptanceComplete`, `toContractWorkItem`                                                                                                                                    |
| **rules**      | `assertUpdateRules`, status/claim primitives (`canTransition`, `isClaimed`, `isClaimable`, `unclaim`, `assertClaimAndBlocked`), `assertParentEdge`/`expectedParentType`, id/label/branch guards                                                            |
| **paths**      | `TRACKER_DIR_NAME`, `LEGACY_TRACKER_DIR_NAME`, `trackerAt`, `findTrackerLocation`, `findTasksDir`, `repoRootFromTasks`, `newItemPath`, `readConventionVersion`                                                                                             |
| **envelopes**  | `JSON_SCHEMA_VERSION`, `successEnvelope`, `failEnvelope`, `compactWorkItem`, `commitPayload`                                                                                                                                                               |
| **operations** | `listOperation`, `createOperation`, `updateOperation`, `showOperation`, `nextOperation`, `reportOperation`, `validateOperation`, `commentOperation`, `handoffOperation`, `priorityOperation`, `syncOperation`, `importIssuesOperation`                     |
| **view-model** | `sortById`, `sortByPriority`, `priorityTier`, `visibleItems`, `itemsForStatus`, `matchesSubstringFilter`, `applyViewLens`, `openDependencyIds`, `hasOpenDependencies`, `buildStatusIndex`, `statusCounts`, `groupItemsBy`, `treeEntries`, `readyTodoCount` |

### Board view-model (`lib/src/view-model.ts`)

`task-ui-shared-viewmodel`: the derived board data every board surface renders —
the web board (`cli/src/board.ts`), the terminal kanban (`cli/src/tui.ts`) and
the native OpenCode panel (`opencode/plugins/arggon/board.ts`) — so the three
cannot drift as the v2 filters/lenses land. It composes the kernel rules as the
single source (`openDependencies`/`isReady`, `isClaimable`, `parseFilter`/
`matchesPredicate`, `priorityRank`) and adds no I/O, no printing and no
dependency: every function takes already-loaded item arrays and none of them
mutates its input. `groupItemsBy` implements the keyed-group / no-group bucket
rule; `treeEntries` the depth-first, cycle-safe parent flattening;
`openDependencyIds`/`hasOpenDependencies` the ADR 0004 dependency mark;
`applyViewLens` the filter-expression + status + readiness + sort lens
(`@me` resolution stays the caller's job, as in `runList`).

`rules.ts` stays the single source of the claim/reopen invariants: the entry
re-exports it by identity (pinned in `lib/src/index.test.ts`), never as a wrapper.

## Public for the root adapter (not the stable subset)

Everything else the entry re-exports exists so the root package needs no deep
imports, but is **not** frozen for native consumers:

- frontmatter/id primitives (`parseFrontmatter`, `slugify`, …) and the `run*`
  command kernels (`runCreate`, `runUpdate`, …);
- human formatters (`formatListTable`, `renderShowText`, `formatReportTable`,
  `formatTrendTable`, `formatValidateHuman`) — the CLI's eyes-only surface;
- tracker-commit/config helpers (`commitTrackerMutation`, `resolveAutoCommit`,
  `updateGeneratedSection`, …) the root adapter wires;
- worktree-cleanup classification and git plumbing (`classifyCleanupEntry`,
  `defaultCleanupGit`, `findMergedPr`, `CLEANUP_TERMINAL_STATUSES`) — shared by
  the CLI's `cleanup` and the native `cleanup` tool so the merge criterion
  never forks (W4); the native tool injects a domain-backed `worktreeList`;
- `sanitizeHuman*` helpers for the CLI error channel.

Adding names is fine; removing or changing the stable subset (or the
envelopes it returns) is a breaking change for the native tools and must bump
the JSON `schemaVersion` / ship an ADR.

## Tests

The kernel contract is covered by the root suite: `cli/src/lib.test.ts` (entry
surface, in-process), `lib/src/index.test.ts` (the entry re-exports the kernel
modules by identity — `rules.ts` stays the single source), `cli/src/lib-build.test.ts`
(clean build in a fresh clone, real-Node import of the built artifact, a consumer
type-check with no undeclared imports, read **and** write byte parity against
the CLI), plus the moved kernel unit tests under `lib/src/*.test.ts`
(`vitest.config.ts` includes `lib/**/*.test.ts`).
