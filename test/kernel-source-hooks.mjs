/**
 * The resolve hook a SPAWNED test child registers so `@arggondev/lib` loads
 * this checkout's kernel SOURCE instead of the built `lib/dist`
 * (bug-test-suite-lib-dist-rebuild-race).
 *
 * Why this exists: `vitest.config.ts` aliases `@arggondev/lib` to
 * `lib/src/index.ts` so an in-process test never depends on a previous
 * `npm run build`. A spawned child does not inherit that alias — `tsx` does not
 * read `vitest.config.ts` — so the child resolved the package through
 * `node_modules` to `lib/dist`, the one directory in the tree a test is
 * expected to rebuild. That is the asymmetry the flake lived in: any lane that
 * rewrote `lib/dist` in place could hand a concurrently linking child a
 * half-written module, and the child died in Node's ESM loader with an
 * unrelated-looking `SyntaxError: … does not provide an export named …`.
 *
 * The kernel source is a build nobody in the suite rewrites, so a child that
 * loads it cannot observe a rebuild at all. This is isolation, not a retry: no
 * spawn is repeated and no error is swallowed.
 *
 * Kept in its own module so the same hook object can be registered in-thread
 * (`module.registerHooks`, Node >= 22.15) and, on an older runtime, as a
 * hooks-thread module (`module.register`). Test-only: `test/` is outside the
 * `cli/src` build project (`tsconfig.json`) and outside the published
 * `files` allowlist, so it ships to no adopter.
 */

/** The bare specifier every root adapter uses to reach the kernel. */
export const KERNEL_SPECIFIER = "@arggondev/lib";

/**
 * This checkout's kernel source entry, as a URL. Derived from this module's own
 * location (`<repo>/test/`), so a child spawned against a copy of the tree
 * resolves THAT copy's kernel rather than the working tree's.
 */
export const KERNEL_SOURCE = new URL("../lib/src/index.ts", import.meta.url).href;

/**
 * Resolve only the kernel specifier; everything else (including the kernel
 * source's own relative `./foo.js` imports) is the next hook's business, so
 * `tsx` still transpiles the TypeScript it points at.
 */
export const kernelSourceHooks = {
  resolve(specifier, context, nextResolve) {
    if (specifier === KERNEL_SPECIFIER) return { url: KERNEL_SOURCE, shortCircuit: true };
    return nextResolve(specifier, context);
  },
};
