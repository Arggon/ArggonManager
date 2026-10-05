/**
 * Registers {@link ./kernel-source-hooks.mjs} in every SPAWNED test child
 * (`node --import <tsx loader> --import <this file> <entry>`), so `@arggondev/lib`
 * resolves to the kernel source instead of the rebuilt `lib/dist`
 * (bug-test-suite-lib-dist-rebuild-race). `cli/src/test-spawn.ts` owns the argv
 * that carries this `--import`; nothing else needs to know.
 *
 * Two registration paths, same hooks:
 *   - `module.registerHooks` (Node >= 22.15): synchronous and in-thread, so a
 *     child pays no extra thread and no IPC hop per resolution — measured at no
 *     measurable cost across 10 spawns, and it writes nothing to stderr.
 *   - `module.register` (older runtimes): the hooks-thread path. It is kept for
 *     the declared floor (`engines.node >= 22.12.0`); a future removal of
 *     `module.register` is caught by the registration assertion in
 *     `cli/src/kernel-isolation.test.ts`, which fails loudly rather than
 *     silently leaving children on the built kernel.
 *
 * Named imports are avoided on purpose: `registerHooks` does not exist on 22.12,
 * and a missing named export of a builtin is a `SyntaxError` at load time rather
 * than a feature-detectable `undefined`.
 */
import nodeModule from "node:module";

if (typeof nodeModule.registerHooks === "function") {
  const { kernelSourceHooks } = await import("./kernel-source-hooks.mjs");
  nodeModule.registerHooks(kernelSourceHooks);
} else {
  nodeModule.register(new URL("./kernel-source-hooks.mjs", import.meta.url));
}
