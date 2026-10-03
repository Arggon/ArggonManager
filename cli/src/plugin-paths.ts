/**
 * Seam path constants — dependency-free ON PURPOSE.
 *
 * `plugin-bundle.ts` imports the TypeScript compiler API, so anything that
 * imports a constant from there drags `typescript` into the module graph. That
 * is invisible in the repo (a devDependency resolves from the root install) and
 * fatal in a PACKAGED install: `typescript` is not a runtime dependency of
 * `arggon-manager`, so a module reachable from the CLI entry fails to load with
 * `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript'` — which is exactly
 * how bug-generated-seam-bytes-predate-050's doctor freshness check broke the
 * `headless-ci` packed-install lane (it reached `plugin-bundle.js` through
 * `doctor.ts`). Keep this file import-free and re-export from `plugin-bundle.ts`
 * so there is one source of truth.
 */

/** The plugin SOURCE graph the bundle is built from (tsconfig + source files). */
export const PLUGIN_SOURCE = "opencode/plugins/arggon/index.ts";

/**
 * The committed, drift-gated bundle artifact, and the source template `init`
 * vendors byte-for-byte to `.opencode/plugins/arggon/index.ts` — the copy the
 * OpenCode seam actually loads.
 */
export const PLUGIN_BUNDLE = "opencode/plugins/arggon/index.bundle.ts";
