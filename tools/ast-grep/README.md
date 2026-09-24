# Structural architecture rules

`ast-grep` is an exact-pinned, dev-only architecture guard. ESLint and TypeScript
remain responsible for type-aware and general code-quality policy; these rules
protect repository seams that ordinary text lint cannot express.

The project config maps the hand-authored `.ts` and `.tsx` files to ast-grep's
`Tsx` parser. TypeScript and TSX have distinct ASTs; using the TSX superset keeps
one stable rule ID for both instead of maintaining duplicate rule copies. The
scan includes `opencode/plugins/arggon/tui.tsx` as a real TSX source file.

## `tracker-mutations-use-kernel`

Adapters must not import or call the kernel's item-frontmatter serializer, or
write, remove, or move recognizable item/tracker paths. The rule checks source
and destination arguments, member paths, literal paths, and `join`/`resolve`
expressions containing tracker roots and item ids. A bare `filePath` is
intentionally valid because it is not, by itself, evidence of an item mutation.

Item mutations go through `runCreate`/`runUpdate` or their `*Operation` adapters
so locking, validation, claim rules, cascades, and commits stay centralized. The
sole production exception is `lib/src/**`, the kernel that owns serialization
and writes. `cli/src/layout-migrate.ts` has one inline ADR-0012 suppression for
the structural root migration (`tasks/` → `ArggonManager/`); that is a layout
operation, not an item mutation. Product-doc writes remain the owning CLI
command's responsibility.

## `native-tools-use-shared-seam`

Native registration must flow through `TOOL_SPECS`/`WORKTREE_TOOL_SPECS`,
`argonToolDefinitions`, and `registerArgonTools`. A second `ctx.tool.transform`,
`ctx.tool.add`, `ctx.tool.register`, `editor.add({...})`, or `tool()` definition
would fork the native catalog from its schema and parity tests.

The sole production exception is the precise catalog-to-editor flow: an
`editor.add({ ...definition, options: { namespace, codemode } })` inside the
`for (const definition of definitions)` loop in a `registerArgonTools` function
that calls `argonToolDefinitions`. A same-named function without that flow, an
extra add outside the loop, a wrong-shaped add, an alternate registration, or a
second transform remains covered. No exception covers the native plugin source
as a whole.

## Scope and local checks

Both rules scan hand-authored production `.ts`/`.tsx` files. Unit/smoke
harnesses, fixture trees, the committed plugin bundle, and generated/vendored
`.opencode` plugin files are excluded to avoid false positives. The two
package-excluded test helpers `cli/src/test-tmp.ts` and
`cli/src/pack-fixtures.ts` are explicitly excluded and documented here; the
canonical plugin source remains covered by the native-tool rule. These scope
choices do not let production adapters bypass either boundary.

Run the deterministic checks from the repository root:

```sh
npm run test:structure
npm run lint:structure
```

The test command checks positive and negative TypeScript/TSX cases without
snapshots. The lint command uses one worker and never passes `--update-all`; it
reports violations but does not rewrite source.
