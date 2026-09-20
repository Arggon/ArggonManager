/**
 * Single-file, dependency-free plugin bundle builder (ADR 0011 §5/§6,
 * ADR 0013, plan-native-first-011 W3).
 *
 * `arggon init` vendors ONE file into `.opencode/plugins/arggon/index.ts`: the
 * adopter tree must load the plugin (and the native `arggon` tools) without a
 * `node_modules` install. The bundle is built here from the plugin source
 * (`opencode/plugins/arggon/index.ts`) with `@arggon/lib` inlined, using only
 * the TypeScript compiler API (already a devDependency) — no bundler
 * dependency:
 *
 *   1. every reachable module is transpiled to CommonJS with `transpileModule`
 *      (types stripped; `import.meta.url` stays valid because each module is
 *      wrapped in a function inside the emitted ESM file);
 *   2. `require("<specifier>")` calls are resolved at build time into a
 *      `<from>\0<specifier> -> module id` edge map, so the emitted runtime
 *      needs no path resolution: node builtins and anything unmapped fall
 *      through to `createRequire(import.meta.url)`;
 *   3. one ESM wrapper implements the tiny module registry and re-exports the
 *      plugin definition as `default`.
 *
 * The artifact (`opencode/plugins/arggon/index.bundle.ts`) is committed because
 * `init` must work from a source checkout without a build; `npm run
 * build:plugin` regenerates it; `cli/src/plugin-copy.test.ts` drift-gates the
 * committed bytes (assert-before-write) and `npm run check:plugin` enforces the
 * gate in CI. The buffer above `MAX_BUNDLE_BYTES` guards accidental dependency
 * creep (an unmapped bare import would only fail at load time in a
 * dependency-less tree).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

/** Plugin entry (package-root relative, posix). */
export const PLUGIN_SOURCE = "opencode/plugins/arggon/index.ts";

/** Committed single-file bundle `arggon init` vendors (package-root relative). */
export const PLUGIN_BUNDLE = "opencode/plugins/arggon/index.bundle.ts";

/** Kernel entry inlined into the bundle (package-root relative, posix). */
export const KERNEL_ENTRY = "lib/src/index.ts";

/** Bare specifier the plugin imports the kernel with (mapped to KERNEL_ENTRY). */
export const KERNEL_PACKAGE = "@arggon/lib";

/** Generous upper bound: the inlined kernel plus the plugin source. */
export const MAX_BUNDLE_BYTES = 512 * 1024;

/** First line of the generated artifact (the init marker is prepended later). */
export const BUNDLE_BANNER =
  `// ArggonManager plugin bundle — GENERATED, do not edit, do not vendor by hand.` +
  `\n// Build: npm run build:plugin (` +
  `${PLUGIN_SOURCE} + ${KERNEL_PACKAGE} inlined).` +
  `\n// OpenCode V2 loads the vendored copy at .opencode/plugins/arggon/index.ts.`;

export type PluginBundle = {
  /** Complete artifact bytes (banner included). */
  code: string;
  /** Registry ids in emission order (sorted). */
  modules: string[];
  /** `from\0specifier -> target id` build-time resolution table. */
  edges: Map<string, string>;
};

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/**
 * Resolve one module specifier to a root-relative posix module id, or
 * `undefined` when it is not part of the graph (node builtins, unmapped bare
 * packages — the emitted runtime delegates those to node's require).
 *
 * TypeScript NodeNext source imports carry the emitted `.js` extension even
 * though the file on disk is `.ts` (`./frontmatter.js`), so the `.ts` sibling
 * is tried first; `@arggon/lib` maps to the kernel entry.
 */
export function resolveModuleSpecifier(
  root: string,
  fromId: string,
  specifier: string,
): string | undefined {
  if (specifier === KERNEL_PACKAGE) return KERNEL_ENTRY;
  if (!specifier.startsWith(".")) return undefined;
  const fromDir = dirname(join(root, ...fromId.split("/")));
  const base = resolve(fromDir, ...specifier.split("/"));
  const candidates = [
    ...(base.endsWith(".js") ? [`${base.slice(0, -3)}.ts`] : []),
    base,
    `${base}.ts`,
    join(base, "index.ts"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && !candidate.endsWith(sep)) {
      return toPosix(relative(root, candidate));
    }
  }
  return undefined;
}

/** Literal `require("…")` specifiers in already-transpiled CommonJS code. */
const REQUIRE_PATTERN = /\brequire\(\s*(["'])([^"'\n]+)\1\s*\)/g;

function requiredSpecifiers(code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(REQUIRE_PATTERN)) {
    if (!found.includes(match[2]!)) found.push(match[2]!);
  }
  return found;
}

const TRANSPILE_OPTIONS: ts.CompilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  esModuleInterop: true,
  removeComments: true,
  sourceMap: false,
  inlineSourceMap: false,
  declaration: false,
};

/** Transpile one TS module to CommonJS (types stripped, no bundling). */
export function transpileModule(source: string, fileName: string): string {
  return ts.transpileModule(source, {
    fileName,
    compilerOptions: TRANSPILE_OPTIONS,
  }).outputText;
}

/**
 * Build the bundle (pure: no writes). Walks the graph from `entry` with a
 * queue, transpiles every reachable module and records the resolution edges.
 */
export function buildPluginBundle(root: string, entry: string = PLUGIN_SOURCE): PluginBundle {
  const sources = new Map<string, string>();
  const edges = new Map<string, string>();
  const queue: string[] = [entry];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (sources.has(id)) continue;
    const abs = join(root, ...id.split("/"));
    if (!existsSync(abs)) throw new Error(`plugin bundle: module not found: ${id}`);
    const code = transpileModule(readFileSync(abs, "utf8"), abs);
    sources.set(id, code);
    for (const specifier of requiredSpecifiers(code)) {
      const target = resolveModuleSpecifier(root, id, specifier);
      if (target === undefined) continue; // node builtin or unmapped external
      edges.set(`${id}\u0000${specifier}`, target);
      if (!sources.has(target)) queue.push(target);
    }
  }
  const modules = [...sources.keys()].sort();
  const code = emitBundle(modules, sources, edges);
  if (Buffer.byteLength(code, "utf8") > MAX_BUNDLE_BYTES) {
    throw new Error(
      `plugin bundle: ${Buffer.byteLength(code, "utf8")} bytes > ${MAX_BUNDLE_BYTES} bound`,
    );
  }
  return { code, modules, edges };
}

function emitBundle(
  modules: string[],
  sources: Map<string, string>,
  edges: Map<string, string>,
): string {
  const edgeLines = [...edges.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, target]) => `__arggonEdges.set(${JSON.stringify(key)}, ${JSON.stringify(target)})`)
    .join("\n");
  const moduleLines = modules
    .map((id) => {
      const body = sources.get(id)!.replace(/\n$/, "");
      return `__arggonModules.set(${JSON.stringify(id)}, (exports, require, module) => {\n${body}\n})`;
    })
    .join("\n\n");
  return [
    BUNDLE_BANNER,
    `import { createRequire as __arggonCreateRequire } from "node:module"`,
    ``,
    `const __arggonNodeRequire = __arggonCreateRequire(import.meta.url)`,
    `const __arggonModules = new Map()`,
    `const __arggonCache = new Map()`,
    `const __arggonEdges = new Map()`,
    edgeLines,
    ``,
    `function __arggonRequire(id, from) {`,
    `  const resolved = from === undefined ? id : (__arggonEdges.get(from + "\\u0000" + id) ?? id)`,
    `  if (!__arggonModules.has(resolved)) return __arggonNodeRequire(resolved)`,
    `  const cached = __arggonCache.get(resolved)`,
    `  if (cached !== undefined) return cached.exports`,
    `  const module = { exports: {} }`,
    `  __arggonCache.set(resolved, module)`,
    `  __arggonModules.get(resolved)(module.exports, (child) => __arggonRequire(child, resolved), module)`,
    `  return module.exports`,
    `}`,
    ``,
    moduleLines,
    ``,
    `const __arggonEntry = __arggonRequire(${JSON.stringify(PLUGIN_SOURCE)}, undefined)`,
    `export default __arggonEntry.default`,
    ``,
  ].join("\n");
}
