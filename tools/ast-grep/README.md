# Structural architecture rules

`ast-grep` is an exact-pinned, dev-only architecture guard. ESLint and TypeScript
remain responsible for type-aware and general code-quality policy; these rules
protect repository seams that ordinary text lint cannot express.

The project config maps the hand-authored `.ts` and `.tsx` files to ast-grep's
`Tsx` parser. TypeScript and TSX have distinct ASTs; using the TSX superset keeps
one stable rule ID for each boundary instead of maintaining duplicate rule copies.
The scan includes `opencode/plugins/arggon/tui.tsx` as a real TSX source file.

## `tracker-mutations-use-kernel`

Adapters must not import or call the kernel's item-frontmatter serializer, or
write/remove/unlink/truncate recognizable item/tracker **path arguments**. The
rule inspects only the first path argument of those operations, so content such as
`taskFileContent` or `value.filePath` is not scanned. Bare `filePath` and
`outputPath` are intentionally valid, and `ArggonManager/docs` product paths are
excluded.

Item mutations go through `runCreate`/`runUpdate` or their `*Operation` adapters
so locking, validation, claim rules, cascades, and commits stay centralized. The
sole production exception is `lib/src/**`, the kernel that owns serialization
and writes. `cli/src/layout-migrate.ts` has one inline ADR-0012 suppression for
the structural root migration (`tasks/` → `ArggonManager/`); that is a layout
operation, not an item mutation. Product-doc writes remain the owning CLI
command's responsibility.

## `tracker-rename-destination-use-kernel`

A move can create or relocate an item even when its source path is neutral, so
rename destinations are a separate rule. It inspects only the second path
argument, with the same tracker/product-doc exclusions and ADR-0012 suppression.

## `native-tools-use-shared-seam`

Native registration must flow through `TOOL_SPECS`/`WORKTREE_TOOL_SPECS`,
`argonToolDefinitions`, and `registerArgonTools`. The rule rejects direct and
aliased `ctx.tool` transforms, alternate namespaces, `tool({...})` definitions,
identifier/factory `editor.add` forms, and definition loops that are not the
canonical flow.

The sole production exception is the exact catalog-to-editor flow:

- `registerArgonTools` directly binds `definitions` to `argonToolDefinitions(...)`
  and `transform` to `ctx?.tool?.transform`;
- the `transform` call contains the `for (const definition of definitions)` loop;
- the loop contains exactly the recognized
  `editor.add({ ...definition, options: { namespace, codemode } })` payload.

A decoy `argonToolDefinitions` call, a forged `definitions` binding, an extra
loop, an extra/wrong-shaped add, an alternate namespace, or a second transform
remains covered. Only a byte-for-byte identical duplicate inside that exact
recognized loop is structurally indistinguishable; that limitation is documented
rather than generalized into a function-name exception.

## Scope and local checks

All three rules scan hand-authored production `.ts`/`.tsx` files. Unit/smoke
harnesses, fixture trees, the committed plugin bundle, and generated/vendored
`.opencode` plugin files are excluded to avoid false positives. The two
package-excluded test helpers `cli/src/test-tmp.ts` and
`cli/src/pack-fixtures.ts` are explicitly excluded and documented here; the
canonical plugin source remains covered by the native-tool rule. These scope
choices do not let production adapters bypass a boundary.

Run the deterministic checks from the repository root:

```sh
npm run test:structure
npm run lint:structure
```

The test command checks positive and negative TypeScript/TSX cases without
snapshots. The lint command uses one worker and never passes `--update-all`; it
reports violations but does not rewrite source.
