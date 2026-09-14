import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["cli/**/*.test.ts", "labs/**/*.test.ts"],
    // task-vitest-global-teardown: safety-net purge of stale arggon-* dirs in
    // os.tmpdir() after the suite (age-gated, concurrent-run-safe — see
    // test/teardown-tmp.ts). Vitest has no globalTeardown hook, so this is a
    // globalSetup file returning a teardown function.
    globalSetup: ["./test/teardown-tmp.ts"],
  },
});
