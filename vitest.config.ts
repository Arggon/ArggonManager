import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "cli/**/*.test.ts",
      "labs/**/*.test.ts",
      "opencode/**/*.test.ts",
      "smoke/**/*.test.ts",
    ],
    // task-vitest-global-teardown: safety-net purge of stale arggon-* dirs in
    // os.tmpdir() after the suite (age-gated, concurrent-run-safe — see
    // test/teardown-tmp.ts). Vitest has no globalTeardown hook, so this is a
    // globalSetup file returning a teardown function.
    globalSetup: ["./test/teardown-tmp.ts"],
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
