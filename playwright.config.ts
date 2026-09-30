import { defineConfig } from "@playwright/test";

/**
 * task-ui-browser-smoke-ci (ADR 0008 tier 2): the `@smoke` browser spec lives
 * in `e2e/` — outside vitest's include globs (lib/, cli/, labs/, opencode/,
 * smoke/) so `npm test` never picks the Playwright specs up — and drives the
 * built CLI on a temp fixture. Chromium only, one worker, bounded retries:
 * CI budget matters and the board is a local, single-engine surface.
 */
export default defineConfig({
  testDir: "e2e",
  // bug-worktree-link-farm-breaks-playwright-runner: in a `start --worktree`
  // checkout node_modules is a link farm, and node's default resolution
  // realpaths the symlinked packages so the runner and the specs' import of
  // @playwright/test load two distinct module instances ("Playwright Test did
  // not expect test.describe() to be called here"). preserveSymlinks keeps
  // every resolution on the worktree's own paths — one instance everywhere —
  // and is a no-op in normal checkouts and CI.
  preserveSymlinks: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
