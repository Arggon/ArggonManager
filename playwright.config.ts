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
