# Structural architecture rules

`ast-grep` is an exact-pinned, dev-only architecture guard. ESLint and TypeScript
remain responsible for type-aware and general code-quality policy; these rules
protect repository seams that ordinary text lint cannot express.

## `tracker-mutations-use-kernel`

Adapters must not import or call the kernel's item-frontmatter serializer, or
directly write, remove, or move recognizable item/tracker paths. Item mutations
go through `runCreate`/`runUpdate` or their `*Operation` adapters so locking,
validation, claim rules, cascades, and commits stay centralized.

The sole production exception is `lib/src/**`, the kernel that owns serialization
and writes. Writes to non-item product docs remain the owning CLI command's
responsibility and are not tracker item mutations.

## `native-tools-use-shared-seam`

Native registration must flow through `TOOL_SPECS`/`WORKTREE_TOOL_SPECS`,
`argonToolDefinitions`, and `registerArgonTools`. A second `ctx.tool.transform`,
`editor.add`, or `tool()` definition would fork the native catalog from its
schema and parity tests.

The sole production exception is `registerArgonTools` registering definitions it
obtained from `argonToolDefinitions` in `opencode/plugins/arggon/index.ts`; that
catalog-to-registration flow is the shared seam. A same-named function that does
not use `argonToolDefinitions` remains covered.

## Scope and local checks

Both rules scan hand-authored production `.ts`/`.tsx` files. Unit/smoke harnesses,
fixture trees, the committed plugin bundle, and generated/vendored `.opencode`
plugin files are excluded to avoid false positives. `lib/src/**` is excluded only
from the tracker rule. The canonical plugin source remains covered by the
native-tool rule; its exception is relational to the catalog-to-registration flow,
not the whole file. These exclusions do not let production adapters bypass either
boundary.

Run the deterministic checks from the repository root:

```sh
npm run test:structure
npm run lint:structure
```

The test command checks positive and negative cases without snapshots. The lint
command uses one worker and never passes `--update-all`; it reports violations but
does not rewrite source.
