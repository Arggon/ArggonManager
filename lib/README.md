# @arggon/lib — ArggonManager kernel

The kernel of ArggonManager as its own package ([ADR 0013](../ArggonManager/docs/adr/0013-lib-package-split.md),
amending [ADR 0011 §5](../ArggonManager/docs/adr/0011-native-first-architecture.md)):
**one logic path, one library**. The root package (`arggon-manager`) ships the
CLI/headless bin and the vendored plugin and depends on this package through
the npm workspace (`"workspaces": ["lib"]`).

- **Entry:** `lib/src/index.ts` → `dist/index.js` + `dist/index.d.ts`, exposed
  through the package `exports` map (ESM only).
- **Build:** `npm run build` at the repo root builds this package first
  (`npm run build --workspace @arggon/lib`), then the root `tsc`.
- **Dependencies:** none at runtime (Node builtins only). No commander, no
  printing, no argv parsing, no bundled assets — the CLI entrypoint and the
  seam generation live in the root package.
- **Assets:** item creation reads the repo's own `templates/<type>.md` first and
  otherwise the `templatesDir` the root adapter injects
  (`create`/`import-issues` options). The library itself ships no templates.

## Stable export subset

The machine surfaces (CLI, MCP adapter, and the native plugin tools of
W2/W3/W4) rely on this subset — it is the contract:

| Area           | Exports                                                                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **items**      | `loadItems`, `itemsById`, `tryLoadItem`, `softTryLoadItem`, `walkTasksTree`, `acceptanceComplete`, `toContractWorkItem`                                                                                                                |
| **rules**      | `assertUpdateRules`, status/claim primitives (`canTransition`, `isClaimed`, `isClaimable`, `unclaim`, `assertClaimAndBlocked`), `assertParentEdge`/`expectedParentType`, id/label/branch guards                                        |
| **paths**      | `TRACKER_DIR_NAME`, `LEGACY_TRACKER_DIR_NAME`, `trackerAt`, `findTrackerLocation`, `findTasksDir`, `repoRootFromTasks`, `newItemPath`, `readConventionVersion`                                                                         |
| **envelopes**  | `JSON_SCHEMA_VERSION`, `successEnvelope`, `failEnvelope`, `compactWorkItem`, `commitPayload`                                                                                                                                           |
| **operations** | `listOperation`, `createOperation`, `updateOperation`, `showOperation`, `nextOperation`, `reportOperation`, `validateOperation`, `commentOperation`, `handoffOperation`, `priorityOperation`, `syncOperation`, `importIssuesOperation` |

`rules.ts` stays the single source of the claim/reopen invariants: the entry
re-exports it by identity (pinned in `cli/src/lib.test.ts`), never as a wrapper.

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
surface, in-process), `cli/src/lib-build.test.ts` (clean build in a fresh clone,
real-Node import of the built artifact, read **and** write byte parity against
the CLI), plus the moved kernel unit tests under `lib/src/*.test.ts`
(`vitest.config.ts` includes `lib/**/*.test.ts`).
