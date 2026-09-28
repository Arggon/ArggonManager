# Structural architecture rules

`ast-grep` is an exact-pinned, dev-only **high-confidence structural guard**.
ESLint and TypeScript remain responsible for type-aware and general code-quality
policy; these rules protect repository seams that ordinary text lint cannot
express.

These rules are deliberately **not** comprehensive semantic enforcement. Each one
only fires on shapes it can prove structurally. The limitations below are part of
the contract, not oversights: the plugin's schema/parity tests and the tracker
kernel remain authoritative.

The project config maps the hand-authored `.ts` and `.tsx` files to ast-grep's
`Tsx` parser. TypeScript and TSX have distinct ASTs; using the TSX superset keeps
one stable rule ID for each boundary instead of maintaining duplicate rule copies.
The scan includes `opencode/plugins/arggon/tui.tsx` as a real TSX source file.

## `tracker-mutations-use-kernel`

Adapters must not import or call the kernel's item-frontmatter serializer, or
mutate a recognizable tracker **path argument**.

Path position only. Two-argument writers (`writeFileSync`, `appendFileSync`,
`writeFileAtomic`, `renameSync`, …) are inspected at their first path argument,
and single- and multi-argument removers (`rm`/`rmSync`, `rmdir`/`rmdirSync`,
`unlink`/`unlinkSync`, `truncate`/`truncateSync`) are inspected at their first
path argument. Content, encoding, and options arguments are never scanned, so a
tracker-shaped string or member access in a content argument cannot trigger the
rule.

A path argument counts as a tracker path only when it carries one of four
structural signals:

- a tracker identifier (`taskPath`, `storyDir`, `itemId`, `trackerMove`, …);
- a `*.filePath` member;
- an `ArggonManager`- or `tasks`-rooted path ending in a tracker item file
  (`initiative`/`epic`/`story`/`task`/`bug`);
- a dynamic path built from `tasksDir`.

`ArggonManager/docs` and documentation paths are explicitly excluded.

Item mutations go through `runCreate`/`runUpdate` or their `*Operation` adapters
so locking, validation, claim rules, cascades, and commits stay centralized. The
sole production exception is `lib/src/**`, the kernel that owns serialization
and writes. `cli/src/layout-migrate.ts` has one inline ADR-0012 suppression for
the structural root migration (`tasks/` → `ArggonManager/`); that is a layout
operation, not an item mutation. Product-doc writes remain the owning CLI
command's responsibility.

### Documented tracker limitations

- A **bare leaf file name** is deliberately not a tracker signal.
  `writeFileSync("story.md", …)`, `writeFileSync(join(root, "docs", "task-beta.md"), …)`
  and `writeFileSync(join(root, "product", "task-beta.md"), …)` are valid. This is
  the cost of not inferring tracker-ness from a file name alone.
- A tracker path assembled from unrelated variable fragments is not inferred.
- Only the `rename` **destination** is treated as a separate boundary (see below);
  a move whose source _and_ destination are both neutral is not flagged.

## `tracker-rename-destination-use-kernel`

A move can create or relocate an item even when its source path is neutral, so
rename destinations are a separate rule. It inspects only the second path
argument, with the same four signals, the same tracker/product-doc exclusions,
and the same ADR-0012 suppression. A bare leaf destination is valid for the same
reason as above.

## `native-tools-use-shared-seam`

Native registration must flow through `TOOL_SPECS`/`WORKTREE_TOOL_SPECS`,
`argonToolDefinitions`, and `registerArgonTools`.

### Scope: hand-authored Arggon plugin sources only

This rule is scoped by path to `opencode/plugins/arggon/**/*.ts(x)`, excluding
the generated bundle, vendored `.opencode` output, and tests. It is **not**
applied to the rest of the repository: unrelated modules may legitimately define
and call their own `register`, `install`, `configure`, `editor.add`,
`editor.namespace`, or `definitions` loops. `tools/ast-grep/tests/non-plugin-valid.tsx`
is a committed scope-regression fixture holding exactly those forms, and
`npm run test:structure` scans it to prove they stay clean.

Inside the plugin the rule rejects direct and optional `ctx.tool` transforms,
adds and registers; the `const transform = ctx?.tool?.transform` alias outside
the canonical flow; `editor.add`/`editor.namespace` outside the exact canonical
catalog flow; definition loops that are not that flow; `tool({...})` definitions;
and imports of `tool`.

The sole production exception is the exact catalog-to-editor flow, which must all
hold at once:

- it is inside a function declaration named `registerArgonTools`;
- that function directly binds `definitions` to `argonToolDefinitions(...)`;
- it directly binds `transform` to `ctx?.tool?.transform`;
- the `transform` call contains the `for (const definition of definitions)` loop;
- the loop contains exactly the recognized payload — a `...definition` spread,
  an `options` pair, `namespace: ARGON_TOOL_NAMESPACE`, and `codemode: true`.

A decoy `argonToolDefinitions` call, a forged `definitions` binding, an extra
loop, an identifier/factory `editor.add`, an alternate namespace such as
`namespace: "fork"`, a wrong-shaped add, or a second transform remains covered.

### Documented native limitations

Deliberate indirection is **outside** this rule's scope and is _not_ claimed to
be covered. Specifically, a computed, destructured, or arbitrarily aliased handle
(`const t = ctx?.tool?.transform; t(…)`, `const { transform } = ctx.tool`, a
helper that returns `ctx.tool.transform`) is not tracked. Only the exact
`const transform = ctx?.tool?.transform` binding is recognised. Plugin
schema/parity tests remain the authoritative check for these shapes.

## Scope and local checks

The two tracker rules scan hand-authored production `.ts`/`.tsx` files outside
`lib/src`. The native rule scans only the hand-authored Arggon plugin sources.
Unit/smoke harnesses, fixture trees, the committed plugin bundle, generated or
vendored `.opencode` plugin files, and `tools/ast-grep/**` itself are excluded to
avoid false positives. The two package-excluded test helpers
`cli/src/test-tmp.ts` and `cli/src/pack-fixtures.ts` are explicitly excluded and
documented here; the canonical plugin source remains covered by the native-tool
rule. These scope choices do not let production adapters bypass a boundary.

Run the deterministic checks from the repository root:

```sh
npm run test:structure
npm run lint:structure
```

`npm run test:structure` runs the positive and negative TypeScript/TSX rule
suites without snapshots, then scans the non-plugin scope-regression fixture.
`npm run lint:structure` uses one worker and never passes `--update-all`; it
reports violations but does not rewrite source.

## Authoring notes

- Only **one** multi-metavariable (`$$$ARGS`) pattern per rule is reliable in
  `@ast-grep/cli@0.45.3`: when several `$$$` patterns appear as siblings in one
  `any`, the effective match set is wrong. The tracker rules therefore unify all
  writer/remover call shapes into a single `$$$` pattern plus a one-argument
  sibling, and express the serializer call relationally instead of as a second
  `$$$` pattern.
- `ast-grep test` does not evaluate a rule's `files`/`ignores` globs, so scope is
  verified by the committed fixture scan rather than by `valid:` snippets.
