# 0013 Kernel package: `@arggondev/lib`

- Status: Accepted
- Date: 2026-09-20
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Amends: [ADR 0011](0011-native-first-architecture.md) §5 (distribution)
- Programme: `task-native-lib-package` (W1b, under `native-redesign`)

- Amendment (2026-09-22): the package publishes as **`@arggondev/lib`** — the
  owner's npm scope; the `@arggon` scope was unavailable. The architecture is
  unchanged and every mention below refers to the same package under its
  published name.

## Context

[ADR 0011](0011-native-first-architecture.md) §5 decided a **single npm
package** shipping kernel + plugin + a thin headless bin. W1
(`task-native-kernel-lib`, PR #372) extracted the kernel as a library but
exposed it as a **subpath export** (`arggon-manager/lib`) of the (private) root
package, and explicitly deferred the package shape to W3/W7.

Product-owner decision (2026-09-20): the kernel ships as its **own package,
`@arggondev/lib`**, not as a subpath export. The root package
(`arggon-manager`) publishes the plugin build + the headless bin and depends on
`@arggondev/lib`. The drivers:

- W2 (`task-native-tools`) and W3 consume a versioned package boundary instead
  of a private subpath; the native tools' dependency is explicit.
- The W3 vendored plugin stays a **single-file, dependency-free bundle built
  from `@arggondev/lib`** — the kernel is the bundle input, not an npm dependency
  of adopter trees.
- The kernel can evolve and be published independently of the seam assets
  (templates, skills, `opencode/`, the plugin).

## Decision

1. **One workspace, two packages.** The kernel lives in `lib/` as
   `@arggondev/lib` (own `package.json`, `tsconfig.json`, `exports`, ESM only, no
   runtime dependencies). The root package declares `"workspaces": ["lib"]`
   and depends on `"@arggondev/lib"` (`^0.3.0`), linked by the workspace; the
   root's `arggon-manager/lib` subpath export is removed.
2. **Surface unchanged.** The entry (`lib/src/index.ts`) is the W1 kernel
   surface — items, rules, paths, envelopes and the twelve `*Operation`s — with
   `rules.ts` still the single source (identity-pinned by tests). The **stable
   subset** the machine surfaces rely on is documented in `lib/README.md`;
   adapter helpers (human formatters, tracker-commit/config helpers,
   frontmatter/id primitives, command `run*` kernels) are public for the root
   package but are not frozen for native consumers.
3. **No deep imports.** The CLI, the MCP adapter and the root tests import
   `@arggondev/lib`; the W1 polish findings (`PriorityMigrateOptions`,
   `SyncFilled`, `HANDOFF_SESSION_CAP`, `parseCsvList`) are re-exported so
   `mcp-server.ts` has no kernel deep imports.
4. **Assets stay in the root package.** The library ships no templates,
   skills, `opencode/` assets or plugin, and it does not print or parse argv.
   Item creation reads the repo's own `templates/<type>.md` first and otherwise
   the `templatesDir` injected by the root adapter (`create`/`import-issues`
   options); W2/W3 must inject it (or embed the templates in the plugin
   bundle).
5. **Build order.** `npm run build` builds `@arggondev/lib` first, then the root
   `tsc`; CI stays `npm ci && npm run build && npm test && npm run lint`.
6. **Publishing deferred.** Both packages stay `private: true` until the
   release waves (W6/W7) flip them and pin registry versions. The kernel
   `exports` map already carries `types`/`import`/`default` conditions so
   `require(esm)` works on Node ≥ 22.12.
7. **Testing.** The clean-build gate builds in a fresh clone (no `dist/` at
   all) and pins read **and** write (`create`, cascade `update`,
   `comment`/`handoff`) byte parity against the CLI, plus tracker-state parity.

## Consequences

- **Positive**: a versioned kernel boundary for W2/W3; the root package keeps
  the distribution assets and the seam generator; the kernel is
  dependency-free, side-effect-free on import, and testable from a clean
  clone; the plugin bundle stays single-file and dependency-free.
- **Negative / accepted**: two manifests and a build order to keep green; the
  workspace link must exist at runtime (`npm install`/`npm ci` at the root);
  the template fallback is now an explicit adapter injection, so W2/W3 must
  pass `templatesDir` (or bundle the templates).
- **Neutral**: no behavior or `--json` contract change — byte parity is pinned
  by `cli/src/lib-build.test.ts` and the W1 surface tests.

## Alternatives considered

- **Subpath export of the root package** (the W1 status quo). Rejected by the
  product owner: consumers would pull the whole root package (assets, plugin,
  bin) to reach the kernel, and the private subpath is not a versioned
  contract.
- **Vendoring the kernel into the plugin with no package.** Rejected: it forks
  the one logic path (ADR 0011 §4) and makes the kernel untestable on its own.
- **Copying the item templates into the library.** Rejected: duplicated assets
  that drift from the `arggon init` scaffolds; adapter injection keeps the root
  package as the single distribution source.
