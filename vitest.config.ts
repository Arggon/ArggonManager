import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Root adapters (CLI, MCP, tests) consume the kernel through its public
    // package entry (@arggondev/lib, ADR 0013). Tests resolve it to the source
    // entry so a run never depends on a previous `npm run build`; the built
    // artifact is exercised for real in cli/src/lib-build.test.ts.
    //
    // bug-test-suite-lib-dist-rebuild-race: that promise held only in-process.
    // A SPAWNED child does not inherit this alias (tsx does not read the vitest
    // config) and resolved the package through `node_modules` to the built
    // `lib/dist`, so any lane rebuilding the shared build raced every other
    // lane's children. Children now get the same resolution through an explicit
    // `--import` hook (`cliNodeArgs` in cli/src/test-spawn.ts,
    // test/kernel-source-resolve.mjs), and test/kernel-artifacts.ts freezes the
    // shared build for the run so a writer cannot produce the race at all.
    alias: [
      {
        find: /^@arggondev\/lib$/,
        replacement: fileURLToPath(new URL("./lib/src/index.ts", import.meta.url)),
      },
      // W5 task-native-tui: `tui.tsx` is vendored verbatim and OpenCode
      // resolves `solid-js` / transpiles its JSX at load time. The repo has no
      // `solid-js` dependency (the vendored file must stay dependency-less), so
      // the unit tests alias the runtime specifiers to a test double.
      {
        find: /^solid-js$/,
        replacement: fileURLToPath(new URL("./test/tui-runtime-stub.ts", import.meta.url)),
      },
      {
        find: /^@opentui\/solid\/jsx-runtime$/,
        replacement: fileURLToPath(new URL("./test/tui-runtime-stub.ts", import.meta.url)),
      },
      {
        find: /^@opentui\/solid\/jsx-dev-runtime$/,
        replacement: fileURLToPath(new URL("./test/tui-runtime-stub.ts", import.meta.url)),
      },
    ],
  },
  // The runtime transpiles the vendored TUI entry with the Solid automatic JSX
  // runtime; mirror that here so the test file graph matches the runtime shape
  // (Vite 8 transforms with oxc, not esbuild).
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@opentui/solid",
    },
  },
  test: {
    include: [
      "lib/**/*.test.ts",
      "cli/**/*.test.ts",
      "labs/**/*.test.ts",
      "opencode/**/*.test.ts",
      "smoke/**/*.test.ts",
    ],
    // task-vitest-global-teardown: safety-net purge of stale arggon-* dirs in
    // os.tmpdir() after the suite (age-gated, concurrent-run-safe — see
    // test/teardown-tmp.ts). Vitest has no globalTeardown hook, so this is a
    // globalSetup file returning a teardown function.
    //
    // test/kernel-artifacts.ts is the second one (bug-test-suite-lib-dist-rebuild-race):
    // it freezes the repo's built artifacts for the run and fails the run if
    // anything moved them, so a lane cannot rebuild the shared `lib/dist` under
    // the readers. Order is irrelevant — the two share nothing.
    globalSetup: ["./test/teardown-tmp.ts", "./test/kernel-artifacts.ts"],
    // bug-spawn-sync-test-timeout-flake: the cli/ files mix fast in-process
    // unit tests with spawnSync e2e tests that launch `node + tsx + cli.ts`
    // per invocation (~400ms warm, multiple seconds cold or when the machine
    // is loaded). Those flakily exceeded vitest's 5s default testTimeout
    // under load (two documented instances; precedent
    // bug-next-json-test-flakily-exceeds-vitest-5s-timeout fixed one test at
    // a time). 30s across the suite: a timeout only ever fires on a genuinely
    // hung test, so passing runs never pay anything. Scoping it to cli/ via
    // vitest `projects` was tried first and DOUBLED the suite (every file ran
    // under both projects, racing tmp-hygiene tests against themselves).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
